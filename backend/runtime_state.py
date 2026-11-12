import importlib
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import HTTPException

from detector import ColorDetector, DefectTracker, Detection, Visualizer
from dvr_types import DvrBrand, DvrDeviceConfig

try:
    from schemas import DetectorConfig
except ImportError:
    from backend.schemas import DetectorConfig

try:
    from db import (
        get_runtime_setting,
        set_operator_active_camera,
        set_runtime_setting,
    )
except ImportError:
    from backend.db import (
        get_runtime_setting,
        set_operator_active_camera,
        set_runtime_setting,
    )

try:
    from stream_manager import (
        CameraState,
        ChannelStreamPool,
        ChannelStreamWorker,
        StreamSessionManager,
    )
except ImportError:
    from backend.stream_manager import (
        CameraState,
        ChannelStreamPool,
        ChannelStreamWorker,
        StreamSessionManager,
    )

load_dotenv()

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
CAMERA_IP = os.getenv("CAMERA_IP", "")
CAMERA_RTSP_PORT = int(os.getenv("CAMERA_RTSP_PORT", "554"))
CAMERA_USER = os.getenv("CAMERA_USER", "admin")
CAMERA_PASSWORD = os.getenv("CAMERA_PASSWORD", "")
CAMERA_CHANNEL = os.getenv("CAMERA_CHANNEL", "101")

if os.getenv("CAMERA_RTSP_URL"):
    CAMERA_RTSP_URL = os.getenv("CAMERA_RTSP_URL", "")
elif CAMERA_IP and CAMERA_PASSWORD and CAMERA_PASSWORD != "sua_senha_aqui":
    CAMERA_RTSP_URL = (
        f"rtsp://{CAMERA_USER}:{CAMERA_PASSWORD}@{CAMERA_IP}:{CAMERA_RTSP_PORT}/Streaming/Channels/{CAMERA_CHANNEL}"
    )
else:
    CAMERA_RTSP_URL = "mock://127.0.0.1/channel/1"

OUTPUT_FPS = float(os.getenv("OUTPUT_FPS", "12"))
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "80"))
CONNECT_TIMEOUT_SECONDS = float(os.getenv("CONNECT_TIMEOUT_SECONDS", "5"))
COLOR_REFERENCE_PATH = Path(
    os.getenv(
        "COLOR_REFERENCE_PATH",
        str(Path(__file__).with_name("calibrated-color-reference.json")),
    )
)
ACTIVE_CAMERA_STATE_PATH = Path(
    os.getenv(
        "ACTIVE_CAMERA_STATE_PATH",
        str(Path(__file__).with_name("active-operator-camera.json")),
    )
)
USE_FFMPEG_FALLBACK = os.getenv("USE_FFMPEG_FALLBACK", "1") != "0"

logging.basicConfig(level=logging.INFO)
_log = logging.getLogger("backend.runtime")


def _load_color_reference() -> tuple[Optional[int], Optional[int], Optional[list]]:
    try:
        saved = get_runtime_setting("color_reference")
        if isinstance(saved, dict):
            ref_a = int(saved["ref_a"]) if saved.get("ref_a") is not None else None
            ref_b = int(saved["ref_b"]) if saved.get("ref_b") is not None else None
            paleta_raw = saved.get("paleta")
            paleta = None
            if isinstance(paleta_raw, list) and paleta_raw:
                paleta = [(int(p[0]), int(p[1])) for p in paleta_raw]
            if ref_a is not None or paleta:
                _log.info("Referência de cor carregada do PostgreSQL com sucesso")
                return ref_a, ref_b, paleta
    except Exception as err:
        _log.warning("Falha ao recuperar referência de cor do PostgreSQL: %s", err)

    try:
        if COLOR_REFERENCE_PATH.exists():
            saved = json.loads(COLOR_REFERENCE_PATH.read_text(encoding="utf-8"))
            ref_a = int(saved["ref_a"]) if "ref_a" in saved and saved["ref_a"] is not None else None
            ref_b = int(saved["ref_b"]) if "ref_b" in saved and saved["ref_b"] is not None else None
            paleta_raw = saved.get("paleta")
            paleta = None
            if isinstance(paleta_raw, list) and paleta_raw:
                paleta = [(int(p[0]), int(p[1])) for p in paleta_raw]
            if set_runtime_setting("color_reference", saved):
                COLOR_REFERENCE_PATH.unlink(missing_ok=True)
                _log.info("Referência de cor migrada para o PostgreSQL e JSON legado removido")
            return ref_a, ref_b, paleta
    except (FileNotFoundError, KeyError, TypeError, ValueError, json.JSONDecodeError, OSError):
        pass
    return None, None, None


color_reference_lock = threading.Lock()
saved_ref_a, saved_ref_b, saved_paleta = _load_color_reference()
N_CORES_PALETA = 3


class PipelineState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.latest_analyzed_frame: Optional[bytes] = None


pipeline_state = PipelineState()
channel_stream_pool = ChannelStreamPool(
    output_fps=OUTPUT_FPS,
    jpeg_quality=JPEG_QUALITY,
    use_ffmpeg_fallback=USE_FFMPEG_FALLBACK,
)


def _on_operator_camera_switch(stream_url: str) -> None:
    try:
        with pipeline_state.lock:
            pipeline_state.latest_analyzed_frame = None
        channel_stream_pool.stop_matching(stream_url)
    except Exception:
        pass


camera_state = CameraState(
    default_rtsp_url=CAMERA_RTSP_URL,
    camera_ip=CAMERA_IP,
    camera_channel=CAMERA_CHANNEL,
    output_fps=OUTPUT_FPS,
    jpeg_quality=JPEG_QUALITY,
    connect_timeout_seconds=CONNECT_TIMEOUT_SECONDS,
    use_ffmpeg_fallback=USE_FFMPEG_FALLBACK,
    legacy_state_path=ACTIVE_CAMERA_STATE_PATH,
    on_switch_callback=_on_operator_camera_switch,
)

current_detector_config = DetectorConfig()
detector_lock = threading.Lock()
global_tracker = DefectTracker()
classic_detector = ColorDetector()
anomalib_detector_instance = None
global_detector = classic_detector
current_detector_mode = os.getenv("DETECTOR_MODE", "classic").lower()
_anomalib_mtime: float = 0.0


def get_or_load_anomalib_detector():
    global anomalib_detector_instance, _anomalib_mtime
    anomalib_file = Path(__file__).with_name("anomalib_detector.py")
    current_mtime = anomalib_file.stat().st_mtime if anomalib_file.exists() else 0.0

    if anomalib_detector_instance is not None and current_mtime == _anomalib_mtime:
        return anomalib_detector_instance

    import anomalib_detector

    if anomalib_detector_instance is not None and current_mtime != _anomalib_mtime:
        _log.info("Detectada alteração em anomalib_detector.py — recarregando detector automaticamente...")
        importlib.reload(anomalib_detector)

    models_dir = Path(__file__).with_name("models")
    backbone_path = models_dir / "resnet18_backbone.pth"
    anomalib_detector_instance = anomalib_detector.AnomalibDetector(backbone_path=str(backbone_path))
    _anomalib_mtime = current_mtime
    _log.info("AnomalibDetector carregado com backbone: %s", backbone_path)
    return anomalib_detector_instance


def resolve_detector_for_config(estampado: bool):
    """
    Regra de negócio:
    - Tecido liso (estampado=False) -> OpenCV clássico (ColorDetector)
    - Tecido detalhado/estampado (estampado=True) -> Anomalib (AnomalibDetector), com fallback seguro
      para OpenCV caso o modelo falhe ao carregar.
    """
    global current_detector_mode, global_detector
    if estampado:
        try:
            det = get_or_load_anomalib_detector()
            current_detector_mode = "anomalib"
            global_detector = det
            return det
        except Exception as err:
            _log.warning("Falha ao ativar Anomalib para tecido estampado, usando OpenCV como fallback: %s", err)

    current_detector_mode = "classic"
    global_detector = classic_detector
    return classic_detector


def decode_latest_frame() -> np.ndarray:
    frame = camera_state.get_bgr_frame()
    if frame is None:
        raise HTTPException(status_code=503, detail="Nenhum frame disponivel no momento")
    return frame


def pipeline_worker() -> None:
    frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08
    while True:
        if not camera_state.running:
            break

        started_at = time.time()
        frame = camera_state.get_bgr_frame()

        if frame is None:
            time.sleep(0.1)
            continue

        try:
            with detector_lock:
                config_dict = (
                    current_detector_config.model_dump()
                    if hasattr(current_detector_config, "model_dump")
                    else current_detector_config.dict()
                )

            w_pct = config_dict.get("w", 60)
            h_pct = config_dict.get("h", 50)
            h_frame, w_frame = frame.shape[:2]
            largura = max(2, int(w_frame * (w_pct / 100.0)))
            altura = max(2, int(h_frame * (h_pct / 100.0)))
            x_inicio = max(0, int(w_frame / 2 - largura / 2))
            y_inicio = max(0, int(h_frame / 2 - altura / 2))
            x_fim = min(w_frame, x_inicio + largura)
            y_fim = min(h_frame, y_inicio + altura)

            roi = frame[y_inicio:y_fim, x_inicio:x_fim]

            if not config_dict.get("apenas_area", False) and roi.size > 0:
                with color_reference_lock:
                    if config_dict.get("ref_a") is None and config_dict.get("ref_b") is None:
                        config_dict["paleta"] = saved_paleta
                        config_dict["ref_a"] = saved_ref_a
                        config_dict["ref_b"] = saved_ref_b

                active_detector = resolve_detector_for_config(bool(config_dict.get("estampado", False)))
                detections = active_detector.detect(roi, config_dict)

                fixed_abs_detections = []
                for det in detections:
                    abs_bx0 = det.box[0] + x_inicio
                    abs_by0 = det.box[1] + y_inicio
                    abs_bx1 = det.box[2] + x_inicio
                    abs_by1 = det.box[3] + y_inicio
                    abs_cx = det.centroid[0] + x_inicio
                    abs_cy = det.centroid[1] + y_inicio
                    fixed_abs_detections.append(
                        Detection(
                            box=(abs_bx0, abs_by0, abs_bx1, abs_by1),
                            centroid=(abs_cx, abs_cy),
                            area=det.area,
                            label=det.label,
                            confidence=det.confidence,
                        )
                    )

                orientacao = config_dict.get("linha_orientacao", "vertical")
                global_tracker.linha_orientacao = orientacao
                if orientacao == "horizontal":
                    linha_pos_abs = y_inicio + int(altura * (config_dict.get("linha_posicao_percent", 50) / 100.0))
                else:
                    linha_pos_abs = x_inicio + int(largura * (config_dict.get("linha_posicao_percent", 50) / 100.0))

                ativos = global_tracker.update(fixed_abs_detections, linha_pos_abs)
                processed_frame = Visualizer.draw_results(
                    frame, config_dict, ativos, fixed_abs_detections, x_inicio, y_inicio, x_fim, y_fim
                )
            else:
                processed_frame = Visualizer.draw_results(
                    frame, config_dict, [], [], x_inicio, y_inicio, x_fim, y_fim
                )

            encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
            encoded_ok, jpg = cv2.imencode(".jpg", processed_frame, encode_params)
            if encoded_ok:
                with pipeline_state.lock:
                    pipeline_state.latest_analyzed_frame = jpg.tobytes()
        except Exception as e:
            _log.error("Erro no pipeline worker: %s", e)

        elapsed = time.time() - started_at
        sleep_time = max(0.0, frame_interval - elapsed)
        time.sleep(sleep_time)


pipeline_thread = threading.Thread(target=pipeline_worker, daemon=True)
pipeline_thread.start()

stream_session_manager = StreamSessionManager(check_interval_seconds=15.0)

if CAMERA_IP:
    stream_session_manager.register_device(
        DvrDeviceConfig(
            id="dvr-default-hikvision",
            name="Hikvision Linha Industrial 01",
            brand=DvrBrand.HIKVISION,
            host=CAMERA_IP,
            rtsp_port=CAMERA_RTSP_PORT,
            http_port=80,
            sdk_port=8000,
            username=CAMERA_USER,
            password=CAMERA_PASSWORD or "",
            total_channels=1,
        )
    )
stream_session_manager.register_device(
    DvrDeviceConfig(
        id="dvr-mock-default",
        name="Simulador CFTV Têxtil (MockAdapter)",
        brand=DvrBrand.MOCK,
        host="127.0.0.1",
        rtsp_port=8090,
        http_port=8090,
        sdk_port=8090,
        username="admin",
        password="",
        total_channels=2,
    )
)


def resolve_dvr_password(dvr_id: str, host: str, port: int, brand: str = "") -> str:
    cfg = stream_session_manager.get_device_config(dvr_id)
    if cfg and cfg.password and str(cfg.password).lower() not in ("configured", "none", "null"):
        return cfg.password
    with stream_session_manager._lock:
        for entry in stream_session_manager._devices.values():
            if entry.config.host == host and int(entry.config.rtsp_port) == int(port):
                if entry.config.password and str(entry.config.password).lower() not in ("configured", "none", "null"):
                    return entry.config.password
    if brand.lower() == "droidcam":
        return ""
    if CAMERA_PASSWORD and str(CAMERA_PASSWORD).lower() not in ("configured", "none", "null"):
        return CAMERA_PASSWORD
    return ""
