import os
import json
import threading
import time
from typing import Optional
from pathlib import Path
import subprocess
import logging

import cv2
import numpy as np
from detector import to_grayscale, ColorDetector, DefectTracker, Visualizer, Detection
from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
import random

try:
    from schemas import (
        HealthResponse,
        MessageResponse,
        RgbColor,
        ReferenceColorPayload,
        ReferencePalettePayload,
        ReferencePaletteResponse,
        SampleColorResponse,
        RobustSamplingConfig,
        RobustSampleResponse,
        DetectorConfig,
        DetectorModePayload,
        DetectorModeResponse,
        CalibratePatternPayload,
        CalibratePatternResponse,
        PatternStatusResponse,
        ClearPatternResponse,
        DefectCountResponse,
        ResetCountResponse,
        DvrSetStreamProfilePayload,
        DvrSetActiveCameraPayload,
        DvrActiveCameraResponse,
        DvrDiscoverResponse,
        DvrMonitorStatusResponse,
        DvrEventsResponse,
    )
except ImportError:
    from backend.schemas import (
        HealthResponse,
        MessageResponse,
        RgbColor,
        ReferenceColorPayload,
        ReferencePalettePayload,
        ReferencePaletteResponse,
        SampleColorResponse,
        RobustSamplingConfig,
        RobustSampleResponse,
        DetectorConfig,
        DetectorModePayload,
        DetectorModeResponse,
        CalibratePatternPayload,
        CalibratePatternResponse,
        PatternStatusResponse,
        ClearPatternResponse,
        DefectCountResponse,
        ResetCountResponse,
        DvrSetStreamProfilePayload,
        DvrSetActiveCameraPayload,
        DvrActiveCameraResponse,
        DvrDiscoverResponse,
        DvrMonitorStatusResponse,
        DvrEventsResponse,
    )

try:
    from db import (
        get_runtime_setting,
        set_runtime_setting,
        set_operator_active_camera,
    )
except ImportError:
    from backend.db import (
        get_runtime_setting,
        set_runtime_setting,
        set_operator_active_camera,
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

# Fallback to using ffmpeg subprocess for more robust H.264 handling
USE_FFMPEG_FALLBACK = os.getenv("USE_FFMPEG_FALLBACK", "1") != "0"

logging.basicConfig(level=logging.INFO)
_log = logging.getLogger("camera-proxy")


def _load_color_reference() -> tuple[Optional[int], Optional[int], Optional[list]]:
    # 1. Tenta carregar do PostgreSQL (tabela system_runtime_settings)
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

    # 2. Fallback de migração inicial (se existir JSON legado no disco)
    try:
        if COLOR_REFERENCE_PATH.exists():
            saved = json.loads(COLOR_REFERENCE_PATH.read_text(encoding="utf-8"))
            ref_a = int(saved["ref_a"]) if "ref_a" in saved else None
            ref_b = int(saved["ref_b"]) if "ref_b" in saved else None
            paleta_raw = saved.get("paleta")
            paleta = None
            if isinstance(paleta_raw, list) and paleta_raw:
                paleta = [(int(p[0]), int(p[1])) for p in paleta_raw]
            set_runtime_setting("color_reference", saved)
            _log.info("Referência de cor migrada do disco legado para o PostgreSQL")
            return ref_a, ref_b, paleta
    except (FileNotFoundError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        pass
    return None, None, None



color_reference_lock = threading.Lock()
saved_ref_a, saved_ref_b, saved_paleta = _load_color_reference()
N_CORES_PALETA = 3

app = FastAPI(
    title="Fabric Analyzer - Backend & Computer Vision API",
    version="2.0.0",
    description="API de visão computacional (OpenCV e Anomalib), streaming MJPEG e gerenciamento de câmeras/DVRs.",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post(
    "/reference-palette",
    response_model=ReferencePaletteResponse,
    tags=["Calibração"],
    summary="Salva paleta de cores de referência do tecido",
)
def save_reference_palette(payload: ReferencePalettePayload) -> JSONResponse:
    """
    Recebe uma lista de amostras RGB coletadas na ROI (ex: vários pontos
    do xadrez), converte pra Lab e agrupa em N_CORES_PALETA clusters via
    k-means. Salva a paleta resultante como referência do tecido.
    """
    global saved_ref_a, saved_ref_b, saved_paleta

    samples = payload.samples
    if not samples:
        raise HTTPException(status_code=400, detail="Informe 'samples': lista de {r,g,b}")

    lab_points = []
    for s in samples:
        r, g, b = s.r, s.g, s.b
        rgb_arr = np.uint8([[[r, g, b]]])
        lab_arr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2LAB)
        lab_points.append([float(lab_arr[0, 0, 1]), float(lab_arr[0, 0, 2])])

    if not lab_points:
        raise HTTPException(status_code=400, detail="Nenhuma amostra valida em 'samples'")

    data = np.array(lab_points, dtype=np.float32)
    k = min(N_CORES_PALETA, len(data))

    if k == 1:
        centers = np.array([[float(np.mean(data[:, 0])), float(np.mean(data[:, 1]))]])
    else:
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
        _, _, centers = cv2.kmeans(data, k, None, criteria, 5, cv2.KMEANS_PP_CENTERS)

    paleta = [(int(round(c[0])), int(round(c[1]))) for c in centers]

    # mantém ref_a/ref_b (cor "principal") pra compatibilidade com quem ainda ler só isso
    ref_a = paleta[0][0]
    ref_b = paleta[0][1]

    reference = {
        "ref_a": ref_a,
        "ref_b": ref_b,
        "paleta": [list(p) for p in paleta],
        "n_cores": len(paleta),
    }

    # Persistência centralizada no PostgreSQL
    set_runtime_setting("color_reference", reference)

    try:
        COLOR_REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = COLOR_REFERENCE_PATH.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(reference), encoding="utf-8")
        temporary_path.replace(COLOR_REFERENCE_PATH)
    except OSError as error:
        _log.debug("Aviso: cache local de cor não pôde ser gravado: %s", error)

    with color_reference_lock:
        saved_ref_a, saved_ref_b, saved_paleta = ref_a, ref_b, paleta

    return JSONResponse(reference)

class CameraState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.latest_frame: Optional[bytes] = None
        self.last_frame_ts = 0.0
        self.connected = False
        self.running = True
        self.active_stream_url = CAMERA_RTSP_URL
        self.active_camera_id = "cam-mock-1" if CAMERA_RTSP_URL.startswith("mock://") else "cam-default-101"
        self.active_camera_name = (
            "Câmera Simulada 01 (Aguardando seleção no Gestor CFTV)"
            if CAMERA_RTSP_URL.startswith("mock://")
            else f"Câmera Principal ({CAMERA_IP or 'RTSP'} - Canal {CAMERA_CHANNEL})"
        )
        self.active_brand = "mock" if CAMERA_RTSP_URL.startswith("mock://") else "hikvision"
        self.active_channel = "1" if CAMERA_RTSP_URL.startswith("mock://") else str(CAMERA_CHANNEL)
        self._load_persisted_camera()
        self._switch_version = 0
        self._active_ffmpeg_proc: Optional[subprocess.Popen] = None
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()
        self._ffmpeg_thread: Optional[threading.Thread] = None

    def _load_persisted_camera(self) -> None:
        # 1. Tenta recuperar do PostgreSQL (tabela system_runtime_settings)
        try:
            saved = get_runtime_setting("active_operator_camera")
            if isinstance(saved, dict) and saved.get("stream_url"):
                self.active_stream_url = str(saved["stream_url"])
                self.active_camera_id = str(saved.get("camera_id") or self.active_camera_id)
                self.active_camera_name = str(saved.get("camera_name") or self.active_camera_name)
                self.active_brand = str(saved.get("brand") or self.active_brand)
                self.active_channel = str(saved.get("channel") or self.active_channel)
                _log.info(
                    "Câmera ativa do operador restaurada do PostgreSQL: %s (%s)",
                    self.active_camera_name,
                    self.active_brand,
                )
                return
        except Exception as err:
            _log.warning("Falha ao recuperar câmera ativa do PostgreSQL: %s", err)

        # 2. Fallback de migração inicial (se existir JSON legado no disco)
        try:
            if ACTIVE_CAMERA_STATE_PATH.exists():
                saved = json.loads(ACTIVE_CAMERA_STATE_PATH.read_text(encoding="utf-8"))
                if saved.get("stream_url"):
                    self.active_stream_url = str(saved["stream_url"])
                    self.active_camera_id = str(saved.get("camera_id") or self.active_camera_id)
                    self.active_camera_name = str(saved.get("camera_name") or self.active_camera_name)
                    self.active_brand = str(saved.get("brand") or self.active_brand)
                    self.active_channel = str(saved.get("channel") or self.active_channel)
                    _log.info(
                        "Câmera ativa migrada do disco legado para o PostgreSQL: %s (%s)",
                        self.active_camera_name,
                        self.active_brand,
                    )
                    set_operator_active_camera(
                        self.active_camera_id,
                        self.active_camera_name,
                        self.active_brand,
                        self.active_stream_url,
                        self.active_channel,
                    )
        except Exception as err:
            _log.warning("Could not load persisted operator camera: %s", err)

    def _persist_camera(self) -> None:
        try:
            # Persistência centralizada no PostgreSQL (system_runtime_settings e camera_devices)
            set_operator_active_camera(
                camera_id=self.active_camera_id,
                camera_name=self.active_camera_name,
                brand=self.active_brand,
                stream_url=self.active_stream_url,
                channel=self.active_channel,
            )

            payload = {
                "stream_url": self.active_stream_url,
                "camera_id": self.active_camera_id,
                "camera_name": self.active_camera_name,
                "brand": self.active_brand,
                "channel": self.active_channel,
                "updated_at": time.time(),
            }
            tmp_path = ACTIVE_CAMERA_STATE_PATH.with_suffix(".tmp")
            tmp_path.write_text(json.dumps(payload), encoding="utf-8")
            tmp_path.replace(ACTIVE_CAMERA_STATE_PATH)
        except Exception as err:
            _log.warning("Could not persist active operator camera: %s", err)

    def switch_camera(
        self,
        stream_url: str,
        camera_id: str = "",
        camera_name: str = "",
        brand: str = "generic_rtsp",
        channel: str = "1",
    ) -> dict:
        with self.lock:
            self.active_stream_url = stream_url
            self.active_camera_id = camera_id or self.active_camera_id
            self.active_camera_name = camera_name or f"Câmera {brand.upper()} (Canal {channel})"
            self.active_brand = brand
            self.active_channel = str(channel)
            self._switch_version += 1
            self.connected = False
            self.latest_frame = None
            self.last_frame_ts = 0.0
            proc = self._active_ffmpeg_proc
            self._persist_camera()

        if proc is not None:
            try:
                proc.kill()
            except Exception:
                pass

        # Limpa o frame analisado anterior e encerra qualquer worker duplicado do Mosaico para esta mesma câmera
        try:
            if "pipeline_state" in globals():
                with pipeline_state.lock:
                    pipeline_state.latest_analyzed_frame = None
            if "channel_stream_pool" in globals():
                channel_stream_pool.stop_matching(stream_url)
        except Exception:
            pass

        _log.info(
            "Switched active operator camera to id=%s name=%s brand=%s",
            self.active_camera_id,
            self.active_camera_name,
            self.active_brand,
        )
        return self.get_active_info()

    def build_status_frame(self, status_text: str) -> bytes:
        with self.lock:
            cam_name = self.active_camera_name
            brand = self.active_brand
            channel = self.active_channel

        canvas = np.full((360, 640, 3), (15, 23, 42), dtype=np.uint8)
        for y in range(0, 360, 24):
            cv2.line(canvas, (0, y), (640, y), (25, 35, 58), 1)
        for x in range(0, 640, 24):
            cv2.line(canvas, (x, 0), (x, 360), (25, 35, 58), 1)

        cv2.rectangle(canvas, (20, 20), (620, 340), (56, 189, 248), 1)
        cv2.putText(
            canvas,
            f"CAMERA DO OPERARIO ({brand.upper()} - CH {channel})",
            (40, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (56, 189, 248),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            cam_name[:48],
            (40, 115),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.58,
            (226, 232, 240),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            status_text[:55],
            (40, 185),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.58,
            (251, 191, 36),
            1,
            cv2.LINE_AA,
        )
        ts_str = time.strftime("%H:%M:%S")
        cv2.putText(
            canvas,
            f"Sincronizado em tempo real | {ts_str}",
            (40, 310),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (148, 163, 184),
            1,
            cv2.LINE_AA,
        )
        _, jpg = cv2.imencode(".jpg", canvas, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return jpg.tobytes()

    def get_active_info(self) -> dict:
        from dvr_adapters.utils import mask_rtsp_url
        with self.lock:
            return {
                "cameraId": self.active_camera_id,
                "cameraName": self.active_camera_name,
                "brand": self.active_brand,
                "channel": self.active_channel,
                "streamUrlMasked": mask_rtsp_url(self.active_stream_url),
                "connected": self.connected,
                "lastFrameTs": self.last_frame_ts,
                "switchVersion": self._switch_version,
            }

    def _read_http_mjpeg_stream(self, url: str, version: int) -> bool:
        """
        Leitor nativo de streams HTTP MJPEG (DroidCam / IP Webcam).
        Evita o erro do OpenCV quando OPENCV_FFMPEG_CAPTURE_OPTIONS contém rtsp_transport;tcp
        e detecta imediatamente quando o DroidCam retorna página HTML 'DroidCam is Busy'.
        """
        import urllib.request

        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (FabricAnalyzer CameraProxy)"},
            )
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                content_type = (resp.headers.get("Content-Type") or "").lower()
                if "text/html" in content_type:
                    html_preview = resp.read(512).decode("utf-8", errors="ignore")
                    _log.warning(
                        "HTTP camera stream (%s) returned HTML instead of MJPEG (e.g. DroidCam is Busy): %s",
                        self.active_camera_name,
                        "DroidCam is Busy" if "droidcam_busy" in html_preview else content_type,
                    )
                    self.connected = False
                    return False

                buffer = b""
                while self.running and self._switch_version == version:
                    chunk = resp.read(4096)
                    if not chunk:
                        break
                    buffer += chunk
                    while True:
                        start = buffer.find(b"\xff\xd8")
                        end = buffer.find(b"\xff\xd9", start + 2) if start != -1 else -1
                        if start != -1 and end != -1:
                            jpg = buffer[start : end + 2]
                            buffer = buffer[end + 2 :]
                            with self.lock:
                                self.latest_frame = jpg
                                self.last_frame_ts = time.time()
                                self.connected = True
                        else:
                            break
                self.connected = False
                return True
        except Exception as err:
            _log.warning("Direct HTTP MJPEG read failed for %s: %s", self.active_camera_name, err)
            self.connected = False
            return False

    def _capture_loop(self) -> None:
        backoff = 1.0
        while self.running:
            try:
                with self.lock:
                    url = self.active_stream_url
                    version = self._switch_version
                    brand = self.active_brand
                    channel = self.active_channel

                # Suporte nativo ao Simulador Mock em tempo real no painel do Operário
                if url.startswith("mock://") or brand == "mock":
                    from dvr_adapters.utils import load_or_generate_mock_frame
                    try:
                        ch_num = int(channel) if str(channel).isdigit() else 1
                    except ValueError:
                        ch_num = 1
                    frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08
                    while self.running and self._switch_version == version:
                        jpg_bytes, _, _ = load_or_generate_mock_frame(channel=ch_num)
                        with self.lock:
                            self.latest_frame = jpg_bytes
                            self.last_frame_ts = time.time()
                            self.connected = True
                        time.sleep(frame_interval)
                    continue

                # Para streams HTTP/HTTPS (ex: DroidCam / IP Webcam), usa o leitor HTTP MJPEG nativo primeiro
                if url.lower().startswith(("http://", "https://")):
                    _log.info("Opening direct HTTP MJPEG stream for active camera (%s)...", self.active_camera_name)
                    ok_http = self._read_http_mjpeg_stream(url, version)
                    if not ok_http and self._switch_version == version:
                        time.sleep(1.5)
                    continue

                # Prefer OpenCV capture first for RTSP
                _log.info("Attempting OpenCV capture for active camera (%s)...", self.active_camera_name)
                capture = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
                try:
                    capture.set(cv2.CAP_PROP_BUFFERSIZE, 4)
                except Exception:
                    pass
                try:
                    capture.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
                    capture.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
                except Exception:
                    pass

                started_at = time.time()
                self.connected = capture.isOpened()

                if not self.connected:
                    _log.warning("OpenCV failed to open stream (%s), will retry or fallback", self.active_camera_name)
                    capture.release()
                    if USE_FFMPEG_FALLBACK:
                        self._run_ffmpeg_for_version(url, version)
                        continue
                    time.sleep(min(backoff, 10.0))
                    backoff = min(backoff * 2, 10.0)
                    continue

                backoff = 1.0

                while self.running and self._switch_version == version:
                    ok, frame = capture.read()
                    if not ok:
                        self.connected = False
                        _log.warning("OpenCV read returned not ok, breaking to reconnect")
                        break

                    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                    encoded_ok, jpg = cv2.imencode(".jpg", frame, encode_params)
                    if not encoded_ok:
                        _log.debug("Failed to encode frame to jpg, skipping")
                        continue

                    with self.lock:
                        self.latest_frame = jpg.tobytes()
                        self.last_frame_ts = time.time()
                        self.connected = True

                    if time.time() - started_at > CONNECT_TIMEOUT_SECONDS and self.last_frame_ts == 0:
                        self.connected = False
                        _log.warning("Connect timeout exceeded without frames")
                        break

                capture.release()
                self.connected = False
                time.sleep(0.3)
            except Exception as e:
                self.connected = False
                _log.exception("Unexpected error in capture loop: %s", e)
                time.sleep(1.0)

    def stop(self) -> None:
        self.running = False
        if self._active_ffmpeg_proc is not None:
            try:
                self._active_ffmpeg_proc.kill()
            except Exception:
                pass
        self.thread.join(timeout=1.0)

    def _run_ffmpeg_for_version(self, url: str, version: int) -> None:
        """Start ffmpeg subprocess to read RTSP or HTTP (DroidCam) and stream MJPEG frames to stdout."""
        _log.info("Starting ffmpeg fallback for %s", self.active_camera_name)
        cmd = ["ffmpeg"]
        if url.lower().startswith("rtsp://"):
            cmd.extend(["-rtsp_transport", "tcp"])
        cmd.extend([
            "-i",
            url,
            "-f",
            "mjpeg",
            "-q:v",
            "5",
            "-r",
            str(int(OUTPUT_FPS)),
            "pipe:1",
        ])

        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            with self.lock:
                self._active_ffmpeg_proc = proc

            stdout = proc.stdout
            buffer = b""

            while self.running and self._switch_version == version:
                if stdout is None:
                    break
                chunk = stdout.read(4096)
                if not chunk:
                    _log.warning("ffmpeg stdout closed or no data")
                    break
                buffer += chunk

                while True:
                    start = buffer.find(b"\xff\xd8")
                    end = buffer.find(b"\xff\xd9", start + 2) if start != -1 else -1
                    if start != -1 and end != -1:
                        jpg = buffer[start:end + 2]
                        buffer = buffer[end + 2 :]
                        with self.lock:
                            self.latest_frame = jpg
                            self.last_frame_ts = time.time()
                            self.connected = True
                    else:
                        break

            self.connected = False
            try:
                proc.kill()
            except Exception:
                pass
        except FileNotFoundError:
            self.connected = False
            _log.error("ffmpeg not found in PATH. Install ffmpeg to use fallback.")
            time.sleep(2.0)
        except Exception as e:
            self.connected = False
            _log.exception("ffmpeg loop error: %s", e)
            time.sleep(2.0)


camera_state = CameraState()

current_detector_config = DetectorConfig()
detector_lock = threading.Lock()
global_tracker = DefectTracker()
classic_detector = ColorDetector()
anomalib_detector_instance = None
current_detector_mode = os.getenv("DETECTOR_MODE", "classic").lower()


_anomalib_mtime: float = 0.0


def _get_or_load_anomalib_detector():
    global anomalib_detector_instance, _anomalib_mtime
    anomalib_file = Path(__file__).with_name("anomalib_detector.py")
    current_mtime = anomalib_file.stat().st_mtime if anomalib_file.exists() else 0.0

    if anomalib_detector_instance is not None and current_mtime == _anomalib_mtime:
        return anomalib_detector_instance

    import importlib
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



def _resolve_detector_for_config(estampado: bool):
    """
    Regra de negócio:
    - Tecido liso (estampado=False) -> OpenCV clássico (ColorDetector)
    - Tecido detalhado/estampado (estampado=True) -> Anomalib (AnomalibDetector), com fallback seguro
      para OpenCV caso o modelo falhe ao carregar.
    """
    global current_detector_mode, global_detector
    if estampado:
        try:
            det = _get_or_load_anomalib_detector()
            current_detector_mode = "anomalib"
            global_detector = det
            return det
        except Exception as err:
            _log.warning("Falha ao ativar Anomalib para tecido estampado, usando OpenCV como fallback: %s", err)

    current_detector_mode = "classic"
    global_detector = classic_detector
    return classic_detector


class PipelineState:
    def __init__(self):
        self.lock = threading.Lock()
        self.latest_analyzed_frame: Optional[bytes] = None

pipeline_state = PipelineState()

def pipeline_worker():
    frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08
    while True:
        if not camera_state.running:
            break
            
        started_at = time.time()
        
        with camera_state.lock:
            frame_bytes = camera_state.latest_frame
            
        if frame_bytes is None:
            time.sleep(0.1)
            continue
            
        try:
            frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
            frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
            
            if frame is not None:
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

                    active_detector = _resolve_detector_for_config(bool(config_dict.get("estampado", False)))
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
                    
                    processed_frame = Visualizer.draw_results(frame, config_dict, ativos, fixed_abs_detections, x_inicio, y_inicio, x_fim, y_fim)
                else:
                    processed_frame = Visualizer.draw_results(frame, config_dict, [], [], x_inicio, y_inicio, x_fim, y_fim)

                encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                encoded_ok, jpg = cv2.imencode(".jpg", processed_frame, encode_params)
                if encoded_ok:
                    with pipeline_state.lock:
                        pipeline_state.latest_analyzed_frame = jpg.tobytes()
        except Exception as e:
            _log.error(f"Erro no pipeline worker: {e}")
            
        elapsed = time.time() - started_at
        sleep_time = max(0, frame_interval - elapsed)
        time.sleep(sleep_time)

pipeline_thread = threading.Thread(target=pipeline_worker, daemon=True)
pipeline_thread.start()


@app.post(
    "/detector-config",
    response_model=DetectorConfig,
    tags=["Detector"],
    summary="Atualiza a configuração do detector de defeitos",
)
def update_detector_config(config: DetectorConfig) -> JSONResponse:
    global current_detector_config
    with detector_lock:
        current_detector_config = config
        _resolve_detector_for_config(bool(config.estampado))
        data = (
            current_detector_config.model_dump()
            if hasattr(current_detector_config, "model_dump")
            else current_detector_config.dict()
        )
    return JSONResponse(data)

@app.get(
    "/detector-config",
    response_model=DetectorConfig,
    tags=["Detector"],
    summary="Obtém a configuração atual do detector de defeitos",
)
def get_detector_config() -> JSONResponse:
    with detector_lock:
        data = (
            current_detector_config.model_dump()
            if hasattr(current_detector_config, "model_dump")
            else current_detector_config.dict()
        )
        return JSONResponse(data)


@app.get(
    "/detector-mode",
    response_model=DetectorModeResponse,
    tags=["Detector"],
    summary="Retorna o modo ativo do detector e disponibilidade de modelos",
)
def get_detector_mode() -> JSONResponse:
    models_dir = Path(__file__).with_name("models")
    det_status = {}
    if anomalib_detector_instance is not None:
        det_status = anomalib_detector_instance.get_status()
    return JSONResponse(
        {
            "mode": current_detector_mode,
            "estampado": current_detector_config.estampado,
            "backbone_available": (models_dir / "resnet18_backbone.pth").exists(),
            "pattern_status": det_status,
        }
    )


@app.post(
    "/detector-mode",
    response_model=DetectorModeResponse,
    tags=["Detector"],
    summary="Altera o modo ativo do detector ('classic' ou 'anomalib')",
)
def set_detector_mode(payload: DetectorModePayload) -> JSONResponse:
    mode = payload.mode.strip().lower()
    if mode not in ("classic", "anomalib", "yolo"):
        raise HTTPException(status_code=400, detail="mode deve ser 'classic' ou 'anomalib'")

    with detector_lock:
        current_detector_config.estampado = mode in ("anomalib", "yolo")
        _resolve_detector_for_config(current_detector_config.estampado)

    return JSONResponse({"mode": current_detector_mode, "estampado": current_detector_config.estampado})


@app.get(
    "/pattern-status",
    response_model=PatternStatusResponse,
    tags=["Anomalib"],
    summary="Retorna status e metadados da calibração ativa de estampa",
)
def get_pattern_status() -> JSONResponse:
    det = _get_or_load_anomalib_detector()
    return JSONResponse(det.get_status())


@app.post(
    "/clear-pattern",
    response_model=ClearPatternResponse,
    tags=["Anomalib"],
    summary="Limpa a calibração de estampa ativa em memória e disco",
)
def clear_pattern() -> JSONResponse:
    det = _get_or_load_anomalib_detector()
    det.clear_pattern()
    return JSONResponse({"success": True, "calibrated": False})


@app.post(
    "/calibrate-pattern",
    response_model=CalibratePatternResponse,
    tags=["Anomalib"],
    summary="Captura frames de tecido bom ao vivo e calibra a estampa no Anomalib",
)
def calibrate_pattern(payload: CalibratePatternPayload = Body(default=CalibratePatternPayload())) -> JSONResponse:
    """
    Captura automaticamente `num_frames` recortes (ROI) do tecido BOM na câmera ao vivo,
    salva as imagens em `backend/reference_patterns/active_pattern/frames/` e
    constrói o Memory Bank do Anomalib para inspecionar aquela estampa.
    """
    w_pct = max(5, min(100, int(payload.w)))
    h_pct = max(5, min(100, int(payload.h)))
    num_frames = max(3, min(40, int(payload.num_frames)))
    interval_ms = max(40, min(2000, int(payload.interval_ms)))

    captured_rois: list[np.ndarray] = []
    for i in range(num_frames):
        frame = _decode_latest_frame()
        h_frame, w_frame = frame.shape[:2]
        largura = max(2, int(w_frame * (w_pct / 100.0)))
        altura = max(2, int(h_frame * (h_pct / 100.0)))
        x_inicio = max(0, int(w_frame / 2 - largura / 2))
        y_inicio = max(0, int(h_frame / 2 - altura / 2))
        x_fim = min(w_frame, x_inicio + largura)
        y_fim = min(h_frame, y_inicio + altura)

        roi = frame[y_inicio:y_fim, x_inicio:x_fim]
        if roi.size > 0:
            captured_rois.append(roi.copy())

        if i < num_frames - 1:
            time.sleep(interval_ms / 1000.0)

    if not captured_rois:
        raise HTTPException(status_code=503, detail="Não foi possível capturar frames válidos da câmera.")

    det = _get_or_load_anomalib_detector()
    metadata = det.fit_from_frames(captured_rois)

    # Persiste metadados da calibração no PostgreSQL
    set_runtime_setting("anomalib_active_pattern", metadata)

    return JSONResponse(
        {
            "success": True,
            "status": "calibrated",
            "metadata": metadata,
        }
    )

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Sistema"],
    summary="Verifica a integridade do serviço e da câmera",
)
def health() -> JSONResponse:
    age_seconds = max(0.0, time.time() - camera_state.last_frame_ts) if camera_state.last_frame_ts else None
    active_info = camera_state.get_active_info()
    return JSONResponse(
        {
            "connected": camera_state.connected,
            "last_frame_age_seconds": age_seconds,
            "camera_ip": CAMERA_IP,
            "camera_channel": active_info["channel"],
            "active_camera": active_info,
        }
    )


@app.get("/stream.mjpg")
def stream_mjpeg() -> StreamingResponse:
    boundary = "frame"

    def frame_generator():
        frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08

        while True:
            with camera_state.lock:
                frame = camera_state.latest_frame
                age = time.time() - camera_state.last_frame_ts if camera_state.last_frame_ts else 999.0

            if frame is None or age > 6.0:
                frame = camera_state.build_status_frame(
                    "Conectando ao stream da camera..." if frame is None else "Sinal interrompido - reconectando..."
                )

            yield (
                b"--" + boundary.encode() + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
                + frame
                + b"\r\n"
            )
            time.sleep(frame_interval)

    return StreamingResponse(
        frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )

@app.get("/stream-analyzed.mjpg")
def stream_analyzed_mjpeg(
    w: Optional[int] = None,
    h: Optional[int] = None,
    apenas_area: Optional[bool] = None,
    estampado: Optional[bool] = None,
    linha_orientacao: Optional[str] = None,
    linha_posicao_percent: Optional[int] = None,
) -> StreamingResponse:
    with detector_lock:
        if w is not None:
            current_detector_config.w = max(5, min(100, int(w)))
        if h is not None:
            current_detector_config.h = max(5, min(100, int(h)))
        if apenas_area is not None:
            current_detector_config.apenas_area = bool(apenas_area)
        else:
            current_detector_config.apenas_area = False
        if estampado is not None:
            current_detector_config.estampado = bool(estampado)
        if linha_orientacao in ("vertical", "horizontal"):
            current_detector_config.linha_orientacao = linha_orientacao
        if linha_posicao_percent is not None:
            current_detector_config.linha_posicao_percent = max(0, min(100, int(linha_posicao_percent)))

    boundary = "frame"

    def analyzed_frame_generator():
        frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08
        while True:
            with camera_state.lock:
                age = time.time() - camera_state.last_frame_ts if camera_state.last_frame_ts else 999.0
            with pipeline_state.lock:
                jpg_bytes = pipeline_state.latest_analyzed_frame

            if jpg_bytes is None or age > 6.0:
                jpg_bytes = camera_state.build_status_frame(
                    "Conectando ao stream da camera..." if jpg_bytes is None else "Sinal interrompido - reconectando..."
                )
            
            try:
                yield (
                    b"--" + boundary.encode() + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpg_bytes)).encode() + b"\r\n\r\n"
                    + jpg_bytes
                    + b"\r\n"
                )
            except Exception as e:
                _log.debug(f"Cliente desconectado do stream analisado: {e}")
                break

            time.sleep(frame_interval)

    return StreamingResponse(
        analyzed_frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@app.post(
    "/reference-color",
    tags=["Calibração"],
    summary="Converte a cor RGB calibrada para Lab OpenCV e a persiste",
)
def save_reference_color(payload: ReferenceColorPayload) -> JSONResponse:
    """Converte a cor RGB calibrada para Lab OpenCV e a persiste no proxy."""
    global saved_ref_a, saved_ref_b, saved_paleta

    ref_r = payload.r
    ref_g = payload.g
    ref_b = payload.b

    reference_rgb = np.uint8([[[ref_r, ref_g, ref_b]]])
    reference_lab = cv2.cvtColor(reference_rgb, cv2.COLOR_RGB2LAB)
    ref_a = int(reference_lab[0, 0, 1])
    ref_b = int(reference_lab[0, 0, 2])
    paleta = [(ref_a, ref_b)]
    reference = {"ref_a": ref_a, "ref_b": ref_b, "paleta": [list(p) for p in paleta]}

    # Persistência centralizada no PostgreSQL
    set_runtime_setting("color_reference", reference)

    try:
        COLOR_REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = COLOR_REFERENCE_PATH.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(reference), encoding="utf-8")
        temporary_path.replace(COLOR_REFERENCE_PATH)
    except OSError as error:
        _log.debug("Aviso: cache local de cor não pôde ser gravado: %s", error)

    with color_reference_lock:
        saved_ref_a, saved_ref_b, saved_paleta = ref_a, ref_b, paleta

    return JSONResponse({"ref_a": ref_a, "ref_b": ref_b})
@app.get("/stream-grayscale.mjpg")
def stream_grayscale_mjpeg() -> StreamingResponse:
    """Stream de vídeo apenas em tons de cinza"""
    boundary = "frame"

    def grayscale_frame_generator():
        frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08

        while True:
            with camera_state.lock:
                frame_bytes = camera_state.latest_frame

            if frame_bytes is None:
                time.sleep(0.1)
                continue

            try:
                frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
                frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)

                if frame is not None:
                    # Puxa a sua nova função de cinza
                    gray_frame = to_grayscale(frame)

                    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                    encoded_ok, jpg = cv2.imencode(".jpg", gray_frame, encode_params)
                    
                    if encoded_ok:
                        yield (
                            b"--" + boundary.encode() + b"\r\n"
                            b"Content-Type: image/jpeg\r\n"
                            b"Content-Length: " + str(len(jpg.tobytes())).encode() + b"\r\n\r\n"
                            + jpg.tobytes()
                            + b"\r\n"
                        )
            except Exception as e:
                _log.error(f"Erro ao processar frame cinza: {e}")

            time.sleep(frame_interval)

    return StreamingResponse(
        grayscale_frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )

@app.get(
    "/defect-count",
    response_model=DefectCountResponse,
    tags=["Inspeção"],
    summary="Retorna a contagem atual de falhas detectadas",
)
def defect_count() -> JSONResponse:
    """Retorna a contagem atual de falhas detectadas"""
    return JSONResponse(
        {
            "count": global_tracker.total_count,
            "defect_count": global_tracker.total_count,
            "mode": current_detector_mode,
            "estampado": current_detector_config.estampado,
        }
    )


@app.post(
    "/reset-count",
    response_model=ResetCountResponse,
    tags=["Inspeção"],
    summary="Zera a contagem de falhas (usar ao iniciar um novo teste/rolo)",
)
def reset_count() -> JSONResponse:
    """Zera a contagem de falhas (usar ao iniciar um novo teste/rolo)"""
    global_tracker.reset()
    return JSONResponse({"success": True, "count": global_tracker.total_count})

def _decode_latest_frame() -> np.ndarray:
    with camera_state.lock:
        frame_bytes = camera_state.latest_frame

    if frame_bytes is None:
        raise HTTPException(status_code=503, detail="Nenhum frame disponivel no momento")

    frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
    frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=500, detail="Falha ao decodificar frame")

    return frame


@app.get("/snapshot.jpg")
def snapshot() -> Response:
    with camera_state.lock:
        frame_bytes = camera_state.latest_frame

    if frame_bytes is None:
        raise HTTPException(status_code=503, detail="Nenhum frame disponivel no momento")

    return Response(content=frame_bytes, media_type="image/jpeg")


@app.get("/sample-color")
def sample_color() -> JSONResponse:
    frame = _decode_latest_frame()
    height, width = frame.shape[:2]

    center_x = width // 2
    center_y = height // 2
    sample_size = 10

    x0 = max(0, center_x - sample_size)
    x1 = min(width, center_x + sample_size)
    y0 = max(0, center_y - sample_size)
    y1 = min(height, center_y + sample_size)

    region = frame[y0:y1, x0:x1]
    if region.size == 0:
        raise HTTPException(status_code=500, detail="Regiao de amostragem invalida")

    b, g, r = region.mean(axis=(0, 1))
    rgb = {
        "r": int(round(r)),
        "g": int(round(g)),
        "b": int(round(b)),
    }
    hex_value = f"#{rgb['r']:02x}{rgb['g']:02x}{rgb['b']:02x}"

    return JSONResponse(
        {
            "rgb": rgb,
            "hex": hex_value,
            "sample_center": {"x": center_x, "y": center_y},
            "sample_size": sample_size * 2,
        }
    )


def _calculate_color_distance(color1: tuple, color2: tuple) -> float:
    """Calculate Euclidean distance between two RGB colors"""
    r_diff = color1[0] - color2[0]
    g_diff = color1[1] - color2[1]
    b_diff = color1[2] - color2[2]
    return float(np.sqrt(r_diff**2 + g_diff**2 + b_diff**2))


def _remove_color_outliers(colors: list) -> list:
    """Remove outliers using Interquartile Range (IQR) method"""
    if len(colors) <= 3:
        return colors

    # Calculate mean color
    mean_r = np.mean([c[0] for c in colors])
    mean_g = np.mean([c[1] for c in colors])
    mean_b = np.mean([c[2] for c in colors])
    mean_color = (mean_r, mean_g, mean_b)

    # Calculate distances
    distances = [_calculate_color_distance(c, mean_color) for c in colors]
    q1 = float(np.percentile(distances, 25))
    q3 = float(np.percentile(distances, 75))
    iqr = q3 - q1
    threshold = q3 + 1.5 * iqr

    # Filter outliers
    cleaned = [c for i, c in enumerate(colors) if distances[i] <= threshold]

    _log.debug("Removed %s/%s outliers", len(colors) - len(cleaned), len(colors))
    return cleaned if cleaned else colors


def _calculate_robust_mean(colors: list) -> tuple:
    """Calculate weighted mean of RGB colors (resistant to outliers)"""
    if not colors:
        return (128, 128, 128)
    if len(colors) == 1:
        return colors[0]

    # Initial simple mean
    mean_r = np.mean([c[0] for c in colors])
    mean_g = np.mean([c[1] for c in colors])
    mean_b = np.mean([c[2] for c in colors])
    initial_mean = (mean_r, mean_g, mean_b)

    # Weighted mean
    total_weight = 0.0
    weighted_r, weighted_g, weighted_b = 0.0, 0.0, 0.0

    for color in colors:
        distance = _calculate_color_distance(color, initial_mean)
        weight = 1.0 / (1.0 + distance * 5)

        weighted_r += color[0] * weight
        weighted_g += color[1] * weight
        weighted_b += color[2] * weight
        total_weight += weight

    if total_weight > 0:
        return (
            weighted_r / total_weight,
            weighted_g / total_weight,
            weighted_b / total_weight,
        )

    return initial_mean


def _calculate_luminance(rgb: tuple) -> float:
    """Calculate luminance using standard formula"""
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def _get_sampling_grid(sample_points: int) -> tuple[int, int]:
    if sample_points == 4:
        return (2, 2)
    if sample_points == 9:
        return (3, 3)
    return (3, 6)  # 18 points


def _collect_area_samples(
    frame: np.ndarray,
    area_width_percent: float,
    area_height_percent: float,
    sample_points: int,
    pixel_puro: bool = False,
) -> list[tuple[float, float, float]]:
    height, width = frame.shape[:2]
    center_x = width // 2
    center_y = height // 2

    roi_width = max(2, int(width * (area_width_percent / 100.0)))
    roi_height = max(2, int(height * (area_height_percent / 100.0)))

    x0 = max(0, center_x - roi_width // 2)
    x1 = min(width, center_x + roi_width // 2)
    y0 = max(0, center_y - roi_height // 2)
    y1 = min(height, center_y + roi_height // 2)

    roi = frame[y0:y1, x0:x1]
    if roi.size == 0:
        return []

    rows, cols = _get_sampling_grid(sample_points)
    patch_radius = max(2, int(min(roi.shape[0], roi.shape[1]) * 0.04))

    cell_w = roi.shape[1] / cols
    cell_h = roi.shape[0] / rows
    jitter_w = cell_w * 0.3
    jitter_h = cell_h * 0.3

    samples: list[tuple[float, float, float]] = []
    for row in range(rows):
        for col in range(cols):
            base_px = (col + 0.5) * cell_w
            base_py = (row + 0.5) * cell_h
            px = int(base_px + random.uniform(-jitter_w, jitter_w))
            py = int(base_py + random.uniform(-jitter_h, jitter_h))
            px = max(0, min(roi.shape[1] - 1, px))
            py = max(0, min(roi.shape[0] - 1, py))

            if pixel_puro:
                b, g, r = roi[py, px]
            else:
                sx0 = max(0, px - patch_radius)
                sx1 = min(roi.shape[1], px + patch_radius)
                sy0 = max(0, py - patch_radius)
                sy1 = min(roi.shape[0], py + patch_radius)

                patch = roi[sy0:sy1, sx0:sx1]
                if patch.size == 0:
                    continue

                b, g, r = patch.mean(axis=(0, 1))
            samples.append((float(r), float(g), float(b)))

    return samples

@app.get(
    "/reference-palette",
    response_model=ReferencePaletteResponse,
    tags=["Calibração"],
    summary="Obtém a paleta de cor de referência atualmente carregada",
)
def get_reference_palette() -> JSONResponse:
    with color_reference_lock:
        paleta = saved_paleta
        ref_a = saved_ref_a
        ref_b = saved_ref_b
    return JSONResponse({
        "ref_a": ref_a,
        "ref_b": ref_b,
        "paleta": paleta,
        "n_cores": len(paleta) if paleta else 0,
    })


@app.post(
    "/capture-robust-sample",
    response_model=RobustSampleResponse,
    tags=["Calibração"],
    summary="Captura amostras robustas com remoção de outliers e estimativa de estabilidade",
)
def capture_robust_sample(
    sample_count: int = Query(default=5, ge=1, le=20, description="Quantidade de frames a capturar"),
    interval_ms: int = Query(default=200, ge=50, le=5000, description="Intervalo entre frames em ms"),
    area_width_percent: float = Query(default=60.0, gt=0, le=100.0, description="Largura percentual da ROI"),
    area_height_percent: float = Query(default=50.0, gt=0, le=100.0, description="Altura percentual da ROI"),
    sample_points: int = Query(default=9, description="Quantidade de pontos (4, 9 ou 18)"),
    include_samples: bool = Query(default=False, description="Incluir pontos brutos na resposta"),
    pixel_puro: bool = Query(default=False, description="Usar amostragem de pixel puro sem filtro"),
) -> JSONResponse:
    if sample_count < 1 or sample_count > 20:
        raise HTTPException(status_code=400, detail="sample_count deve estar entre 1 e 20")
    if interval_ms < 50 or interval_ms > 5000:
        raise HTTPException(status_code=400, detail="interval_ms deve estar entre 50 e 5000ms")
    if area_width_percent <= 0 or area_width_percent > 100:
        raise HTTPException(status_code=400, detail="area_width_percent deve estar entre 0 e 100")
    if area_height_percent <= 0 or area_height_percent > 100:
        raise HTTPException(status_code=400, detail="area_height_percent deve estar entre 0 e 100")
    if sample_points not in (4, 9, 18):
        raise HTTPException(status_code=400, detail="sample_points deve ser 4, 9 ou 18")

    samples = []
    luminance_values = []
    successful_captures = 0
    raw_point_samples: list[tuple[float, float, float]] = []

    _log.info(
        "Starting robust capture: %s samples, %sms interval, area %.1f%%x%.1f%%, %s points",
        sample_count,
        interval_ms,
        area_width_percent,
        area_height_percent,
        sample_points,
    )

    for i in range(sample_count):
        try:
            frame = _decode_latest_frame()
            frame_samples = _collect_area_samples(
                frame=frame,
                area_width_percent=area_width_percent,
                area_height_percent=area_height_percent,
                sample_points=sample_points,
                pixel_puro=pixel_puro,
            )
            if frame_samples:
                raw_point_samples.extend(frame_samples)   # <-- NOVO: guarda os pontos crus
                frame_mean = _calculate_robust_mean(frame_samples)
                samples.append(frame_mean)
                luminance_values.append(_calculate_luminance(frame_mean))
                successful_captures += 1
                ...
        except Exception:
            _log.exception("Error capturing sample %s", i + 1)

        if i < sample_count - 1:
            time.sleep(interval_ms / 1000.0)


    if not samples:
        raise HTTPException(status_code=503, detail="Nenhuma amostra capturada com sucesso")

    # Remove outliers
    clean_samples = _remove_color_outliers(samples)

    # Calculate robust mean
    robust_mean = _calculate_robust_mean(clean_samples)
    average_luminance = np.mean(luminance_values) if luminance_values else 0

    # Calculate standard deviation
    mean_distance = np.mean([_calculate_color_distance(s, robust_mean) for s in clean_samples])

    rgb_result = {
        "r": int(round(robust_mean[0])),
        "g": int(round(robust_mean[1])),
        "b": int(round(robust_mean[2])),
    }

    hex_value = f"#{rgb_result['r']:02x}{rgb_result['g']:02x}{rgb_result['b']:02x}"

    result = {
        "success": True,
        "rgb": rgb_result,
        "hex": hex_value,
        "samples_captured": successful_captures,
        "samples_total": sample_count,
        "samples_used": len(clean_samples),
        "average_luminance": float(average_luminance) / 255.0,
        "stability_score": max(0.0, 1.0 - mean_distance / 50.0),
        "sampling_config": {
            "area_width_percent": area_width_percent,
            "area_height_percent": area_height_percent,
            "sample_points": sample_points,
        },
    }

    if include_samples:   # <-- NOVO
        result["samples"] = [
            {"r": int(round(r)), "g": int(round(g)), "b": int(round(b))}
            for (r, g, b) in raw_point_samples
        ]

    _log.debug("Robust capture completed: %s", result)
    return JSONResponse(result)


@app.on_event("shutdown")
def shutdown_event() -> None:
    camera_state.stop()



# ============================================================
# MÓDULO CFTV / DVR ADAPTERS (Fase 2)
# ============================================================
from dvr_types import DvrBrand, DvrDeviceConfig
from dvr_adapters import DvrAdapterFactory


@app.post(
    "/dvr/test-connection",
    tags=["CFTV"],
    summary="Testa conectividade e credenciais de um dispositivo DVR/Câmera",
)
def dvr_test_connection(payload: DvrDeviceConfig) -> JSONResponse:
    adapter = DvrAdapterFactory.create(payload)
    result = adapter.test_connection()
    data = result.model_dump(by_alias=True) if hasattr(result, "model_dump") else result.dict(by_alias=True)
    return JSONResponse(data)


@app.post(
    "/dvr/discover",
    response_model=DvrDiscoverResponse,
    tags=["CFTV"],
    summary="Descobre canais e streams disponíveis em um DVR",
)
def dvr_discover_cameras(payload: DvrDeviceConfig) -> JSONResponse:
    adapter = DvrAdapterFactory.create(payload)
    cameras = adapter.discover_cameras()
    items = [
        (cam.model_dump(by_alias=True) if hasattr(cam, "model_dump") else cam.dict(by_alias=True))
        for cam in cameras
    ]
    return JSONResponse({"cameras": items})


@app.get("/dvr/mock/snapshot")
def dvr_mock_snapshot(channel: int = 1) -> Response:
    mock_cfg = DvrDeviceConfig(
        name="Simulador CFTV",
        brand=DvrBrand.MOCK,
        host="127.0.0.1",
        username="admin",
        password="",
        total_channels=max(1, channel),
    )
    adapter = DvrAdapterFactory.create(mock_cfg)
    snap = adapter.capture_snapshot(str(channel))
    return Response(
        content=snap.buffer,
        media_type=snap.mime_type,
        headers={"Cache-Control": "no-store"},
    )



# ============================================================
# MÓDULO CFTV / SERVIÇOS DE CAPTURA E MONITOR (Fase 3)
# ============================================================
from stream_manager import StreamSessionManager

stream_session_manager = StreamSessionManager(check_interval_seconds=15.0)

# Registra a câmera industrial no Health Monitor apenas se estiver definida no ambiente
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


@app.get("/dvr/monitor/status")
def dvr_monitor_status() -> JSONResponse:
    summary = stream_session_manager.get_status_summary(
        active_camera_connected=camera_state.connected,
        last_frame_ts=camera_state.last_frame_ts,
    )
    summary["activeOperatorCamera"] = camera_state.get_active_info()
    return JSONResponse(summary)


@app.post("/dvr/monitor/check-now")
def dvr_monitor_check_now() -> JSONResponse:
    devices = stream_session_manager.run_check_now()
    events = stream_session_manager.get_events(limit=30)
    return JSONResponse({"devices": devices, "events": events})


@app.get("/dvr/monitor/events")
def dvr_monitor_events(limit: int = 50) -> JSONResponse:
    events = stream_session_manager.get_events(limit=limit)
    return JSONResponse({"events": events})


@app.post("/dvr/monitor/register")
def dvr_monitor_register(payload: DvrDeviceConfig) -> JSONResponse:
    entry = stream_session_manager.register_device(payload)
    return JSONResponse({"device": entry})


@app.post("/dvr/capture-snapshot")
def dvr_capture_snapshot_endpoint(
    payload: DvrDeviceConfig, channel: str = "1"
) -> JSONResponse:
    snap_data = stream_session_manager.capture_snapshot_on_demand(payload, channel_or_id=channel)
    return JSONResponse(snap_data)


@app.post(
    "/dvr/stream-profile",
    tags=["CFTV"],
    summary="Altera o perfil de stream (main/sub) no monitor",
)
def dvr_set_stream_profile(payload: DvrSetStreamProfilePayload) -> JSONResponse:
    device_id = payload.deviceId
    subtype = payload.subtype
    updated = stream_session_manager.set_stream_subtype(device_id, subtype)
    if not updated:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado no monitor")
    return JSONResponse({"device": updated})


@app.get(
    "/dvr/active-camera",
    response_model=DvrActiveCameraResponse,
    tags=["CFTV"],
    summary="Retorna qual câmera está atualmente alimentando o Painel do Operário",
)
def dvr_get_active_camera() -> JSONResponse:
    """Retorna qual câmera está atualmente alimentando o Painel do Operário (/stream.mjpg e IA)."""
    return JSONResponse(camera_state.get_active_info())


@app.post(
    "/dvr/active-camera",
    tags=["CFTV"],
    summary="Troca dinamicamente em tempo de execução a câmera que alimenta o operário e a IA",
)
def dvr_set_active_camera(payload: DvrSetActiveCameraPayload) -> JSONResponse:
    """
    Troca dinamicamente em tempo de execução a câmera que alimenta o Painel do Operário
    (/stream.mjpg, /stream-analyzed.mjpg, /snapshot.jpg e pipeline OpenCV/Anomalib).
    Aceita as configurações do DVR + canal ou uma streamUrl explícita.
    """
    camera_id = payload.cameraId or ""
    camera_name = payload.cameraName or "Câmera Operário"
    channel = payload.channel or "1"
    raw_brand = (payload.brand or "generic").lower()
    brand_str = "generic" if raw_brand in ("generic_rtsp", "generic") else raw_brand
    explicit_url = (payload.streamUrl or "").strip()

    if explicit_url and "***" not in explicit_url:
        stream_url = explicit_url
    elif brand_str == "mock":
        stream_url = f"mock://127.0.0.1/channel/{channel}"
    else:
        try:
            raw_pwd = payload.password or ""
            if raw_pwd.lower() in ("configured", "none", "null"):
                raw_pwd = ""
            if not raw_pwd and brand_str != "droidcam":
                raw_pwd = _resolve_dvr_password(
                    payload.dvrId or "",
                    payload.host or CAMERA_IP,
                    int(payload.rtspPort or CAMERA_RTSP_PORT),
                    brand_str,
                )
            dvr_cfg = DvrDeviceConfig(
                id=payload.dvrId or "",
                name=camera_name,
                brand=DvrBrand(brand_str),
                host=payload.host or CAMERA_IP,
                rtsp_port=int(payload.rtspPort or (4747 if brand_str == "droidcam" else CAMERA_RTSP_PORT)),
                http_port=int(payload.httpPort or (4747 if brand_str == "droidcam" else 80)),
                sdk_port=int(payload.sdkPort or 8000),
                username=payload.username or "admin",
                password=raw_pwd,
                total_channels=max(1, int(channel) if channel.isdigit() else 1),
            )
            adapter = DvrAdapterFactory.create(dvr_cfg)
            if hasattr(adapter, "_build_raw_stream_url"):
                stream_url = adapter._build_raw_stream_url("main")
            elif hasattr(adapter, "_build_raw_rtsp_url"):
                stream_url = adapter._build_raw_rtsp_url(channel, "main")
            else:
                stream_url = adapter.get_camera_stream_url(channel, "main")
        except Exception as err:
            raise HTTPException(status_code=400, detail=f"Configuração de câmera inválida: {err}")

    info = camera_state.switch_camera(
        stream_url=stream_url,
        camera_id=camera_id,
        camera_name=camera_name,
        brand=brand_str,
        channel=channel,
    )
    return JSONResponse({"activeCamera": info})


class ChannelStreamWorker:
    """
    Worker independente de captura por canal para o Mosaico Multi-Câmera (Fase 5).
    Garante que cada câmera da grade exiba sua própria imagem (RTSP, DroidCam HTTP ou Mock),
    com encerramento automático por inatividade (lazy-loading) quando o mosaico é fechado.
    """

    def __init__(
        self,
        worker_key: str,
        stream_url: str,
        camera_name: str,
        brand: str,
        host: str,
        port: int,
        channel: str,
    ) -> None:
        self.worker_key = worker_key
        self.stream_url = stream_url
        self.camera_name = camera_name
        self.brand = brand
        self.host = host
        self.port = port
        self.channel = channel
        self.lock = threading.Lock()
        self.latest_frame: Optional[bytes] = None
        self.last_frame_ts: float = 0.0
        self.last_client_ts: float = time.time()
        self.connected: bool = False
        self.running: bool = True
        self._proc: Optional[subprocess.Popen] = None
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def touch(self) -> None:
        self.last_client_ts = time.time()

    def build_status_frame(self, status_text: str) -> bytes:
        canvas = np.full((360, 640, 3), (15, 23, 42), dtype=np.uint8)
        for y in range(0, 360, 24):
            cv2.line(canvas, (0, y), (640, y), (25, 35, 58), 1)
        for x in range(0, 640, 24):
            cv2.line(canvas, (x, 0), (x, 360), (25, 35, 58), 1)

        cv2.rectangle(canvas, (20, 20), (620, 340), (56, 189, 248), 1)
        cv2.putText(
            canvas,
            f"{self.brand.upper()} - CANAL {self.channel}",
            (40, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (56, 189, 248),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            f"Host: {self.host}:{self.port}",
            (40, 115),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (203, 213, 225),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            status_text[:55],
            (40, 185),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.58,
            (251, 191, 36),
            1,
            cv2.LINE_AA,
        )
        ts_str = time.strftime("%H:%M:%S")
        cv2.putText(
            canvas,
            f"Stream Independente Mosaico | {ts_str}",
            (40, 310),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (148, 163, 184),
            1,
            cv2.LINE_AA,
        )
        _, jpg = cv2.imencode(".jpg", canvas, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return jpg.tobytes()

    def stop(self) -> None:
        self.running = False
        if self._proc is not None:
            try:
                self._proc.kill()
            except Exception:
                pass

    def _read_http_mjpeg_once(self) -> bool:
        import urllib.request

        try:
            req = urllib.request.Request(
                self.stream_url,
                headers={"User-Agent": "Mozilla/5.0 (FabricAnalyzer Mosaic)"},
            )
            with urllib.request.urlopen(req, timeout=4.5) as resp:
                ctype = (resp.headers.get("Content-Type") or "").lower()
                if "text/html" in ctype:
                    self.connected = False
                    return False
                buf = b""
                while self.running and (time.time() - self.last_client_ts <= 25.0):
                    chunk = resp.read(4096)
                    if not chunk:
                        break
                    buf += chunk
                    while True:
                        s = buf.find(b"\xff\xd8")
                        e = buf.find(b"\xff\xd9", s + 2) if s != -1 else -1
                        if s != -1 and e != -1:
                            jpg = buf[s : e + 2]
                            buf = buf[e + 2 :]
                            with self.lock:
                                self.latest_frame = jpg
                                self.last_frame_ts = time.time()
                                self.connected = True
                        else:
                            break
                self.connected = False
                return True
        except Exception:
            self.connected = False
            return False

    def _run_loop(self) -> None:
        from dvr_adapters.utils import load_or_generate_mock_frame

        while self.running:
            if time.time() - self.last_client_ts > 25.0:
                _log.info("Stopping idle mosaic worker for %s (%s:%s)", self.camera_name, self.host, self.port)
                self.running = False
                break

            if self.stream_url.startswith("mock://") or self.brand == "mock":
                ch_num = int(self.channel) if str(self.channel).isdigit() else 1
                jpg_bytes, _, _ = load_or_generate_mock_frame(channel=ch_num)
                with self.lock:
                    self.latest_frame = jpg_bytes
                    self.last_frame_ts = time.time()
                    self.connected = True
                time.sleep(1.0 / max(1.0, OUTPUT_FPS))
                continue

            if self.stream_url.lower().startswith(("http://", "https://")):
                ok_http = self._read_http_mjpeg_once()
                if not ok_http and self.running:
                    time.sleep(1.5)
                continue

            try:
                cap = cv2.VideoCapture(self.stream_url, cv2.CAP_FFMPEG)
                try:
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
                    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 4000)
                    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 4000)
                except Exception:
                    pass

                if not cap.isOpened():
                    cap.release()
                    self.connected = False
                    if USE_FFMPEG_FALLBACK:
                        self._run_ffmpeg_once()
                    else:
                        time.sleep(2.0)
                    continue

                while self.running and (time.time() - self.last_client_ts <= 25.0):
                    ok, frame = cap.read()
                    if not ok or frame is None:
                        self.connected = False
                        break
                    ok_enc, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
                    if ok_enc:
                        with self.lock:
                            self.latest_frame = jpg.tobytes()
                            self.last_frame_ts = time.time()
                            self.connected = True
                cap.release()
            except Exception as err:
                _log.debug("Mosaic worker error (%s): %s", self.camera_name, err)
                time.sleep(1.5)

    def _run_ffmpeg_once(self) -> None:
        cmd = ["ffmpeg"]
        if self.stream_url.lower().startswith("rtsp://"):
            cmd.extend(["-rtsp_transport", "tcp"])
        cmd.extend([
            "-i",
            self.stream_url,
            "-f",
            "mjpeg",
            "-q:v",
            "6",
            "-r",
            str(int(max(6, min(OUTPUT_FPS, 12)))),
            "pipe:1",
        ])
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            self._proc = proc
            stdout = proc.stdout
            buf = b""
            while self.running and (time.time() - self.last_client_ts <= 25.0):
                if stdout is None:
                    break
                chunk = stdout.read(4096)
                if not chunk:
                    break
                buf += chunk
                while True:
                    s = buf.find(b"\xff\xd8")
                    e = buf.find(b"\xff\xd9", s + 2) if s != -1 else -1
                    if s != -1 and e != -1:
                        jpg = buf[s : e + 2]
                        buf = buf[e + 2 :]
                        with self.lock:
                            self.latest_frame = jpg
                            self.last_frame_ts = time.time()
                            self.connected = True
                    else:
                        break
            try:
                proc.kill()
            except Exception:
                pass
        except Exception:
            time.sleep(2.0)


class ChannelStreamPool:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._workers: dict[str, ChannelStreamWorker] = {}

    def stop_worker(self, worker_key: str) -> None:
        with self._lock:
            existing = self._workers.pop(worker_key, None)
            if existing:
                existing.stop()

    def stop_matching(self, stream_url: str) -> None:
        with self._lock:
            keys_to_stop = [
                k for k, w in self._workers.items() if w.stream_url == stream_url or w.host in stream_url
            ]
            for k in keys_to_stop:
                w = self._workers.pop(k, None)
                if w:
                    w.stop()

    def get_or_create(
        self,
        worker_key: str,
        stream_url: str,
        camera_name: str,
        brand: str,
        host: str,
        port: int,
        channel: str,
    ) -> ChannelStreamWorker:
        with self._lock:
            existing = self._workers.get(worker_key)
            if existing and existing.running and existing.stream_url == stream_url:
                existing.touch()
                return existing
            if existing:
                existing.stop()
            worker = ChannelStreamWorker(
                worker_key=worker_key,
                stream_url=stream_url,
                camera_name=camera_name,
                brand=brand,
                host=host,
                port=port,
                channel=channel,
            )
            self._workers[worker_key] = worker
            return worker


channel_stream_pool = ChannelStreamPool()


def _resolve_dvr_password(dvr_id: str, host: str, port: int, brand: str = "") -> str:
    cfg = stream_session_manager.get_device_config(dvr_id)
    if cfg and cfg.password and str(cfg.password).lower() not in ("configured", "none", "null"):
        return cfg.password
    # Procura também por host:port entre os dispositivos registrados no monitor
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


@app.get("/dvr/channel-stream.mjpg")
def dvr_channel_stream_mjpeg(
    camId: str = "",
    dvrId: str = "",
    name: str = "Câmera",
    brand: str = "hikvision",
    host: str = "127.0.0.1",
    port: int = 554,
    httpPort: int = 80,
    user: str = "admin",
    channel: str = "1",
    mode: str = "raw",
) -> StreamingResponse:
    """
    Stream MJPEG individual por canal para que o Mosaico Multi-Câmera exiba a imagem
    própria de cada câmera (sem repetir a câmera ativa do operário em todos os slots).
    """
    brand_clean = "generic" if brand.lower() in ("generic_rtsp", "generic") else brand.lower()
    password = _resolve_dvr_password(dvrId, host, port, brand_clean)

    if brand_clean == "mock":
        stream_url = f"mock://127.0.0.1/channel/{channel}"
    else:
        try:
            dvr_cfg = DvrDeviceConfig(
                id=dvrId or f"{brand_clean}-{host}:{port}",
                name=name,
                brand=DvrBrand(brand_clean),
                host=host,
                rtsp_port=int(port),
                http_port=int(httpPort),
                username=user or "admin",
                password=password,
                total_channels=max(1, int(channel) if str(channel).isdigit() else 1),
            )
            adapter = DvrAdapterFactory.create(dvr_cfg)
            if hasattr(adapter, "_build_raw_stream_url"):
                stream_url = adapter._build_raw_stream_url("main")
            elif hasattr(adapter, "_build_raw_rtsp_url"):
                stream_url = adapter._build_raw_rtsp_url(str(channel), "main")
            else:
                stream_url = adapter.get_camera_stream_url(str(channel), "main")
        except Exception:
            stream_url = f"rtsp://{user}:{password}@{host}:{port}/Streaming/Channels/{channel}"

    worker_key = f"{brand_clean}:{host}:{port}:{channel}"
    boundary = "frame"

    def channel_generator():
        frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08
        while True:
            # Se esta câmera específica for a câmera ativa do Operário, SEMPRE compartilha
            # o CameraState/PipelineState e encerra qualquer worker duplicado (evita 'DroidCam is Busy')
            is_same_as_operator = (
                (camId and camId == camera_state.active_camera_id)
                or (camera_state.active_stream_url == stream_url)
                or (
                    host
                    and host != "127.0.0.1"
                    and host in camera_state.active_stream_url
                    and str(channel) == str(camera_state.active_channel)
                )
            )
            if is_same_as_operator:
                channel_stream_pool.stop_worker(worker_key)
                with camera_state.lock:
                    op_frame = camera_state.latest_frame
                    op_age = time.time() - camera_state.last_frame_ts if camera_state.last_frame_ts else 999.0

                if op_frame is not None and op_age <= 6.0:
                    if mode == "analyzed" and pipeline_state.latest_analyzed_frame is not None:
                        frame_bytes = pipeline_state.latest_analyzed_frame
                    else:
                        frame_bytes = op_frame
                else:
                    frame_bytes = camera_state.build_status_frame(
                        "Conectando ao stream da camera..." if op_frame is None else "Sinal interrompido - reconectando..."
                    )
            else:
                worker = channel_stream_pool.get_or_create(
                    worker_key=worker_key,
                    stream_url=stream_url,
                    camera_name=name,
                    brand=brand_clean,
                    host=host,
                    port=port,
                    channel=str(channel),
                )
                worker.touch()
                with worker.lock:
                    frame_bytes = worker.latest_frame
                    age = time.time() - worker.last_frame_ts if worker.last_frame_ts else 999.0

                if frame_bytes is None or age > 8.0:
                    frame_bytes = worker.build_status_frame(
                        "Conectando ao stream da camera..." if age > 8.0 else "Aguardando video..."
                    )
                elif mode == "analyzed":
                    # Aplica overlay da IA sobre o frame desta câmera específica
                    try:
                        arr = np.frombuffer(frame_bytes, dtype=np.uint8)
                        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                        if img is not None:
                            with detector_lock:
                                cfg_dict = (
                                    current_detector_config.model_dump()
                                    if hasattr(current_detector_config, "model_dump")
                                    else current_detector_config.dict()
                                )
                            h_f, w_f = img.shape[:2]
                            larg = max(2, int(w_f * (cfg_dict.get("w", 60) / 100.0)))
                            alt = max(2, int(h_f * (cfg_dict.get("h", 50) / 100.0)))
                            x0 = max(0, int(w_f / 2 - larg / 2))
                            y0 = max(0, int(h_f / 2 - alt / 2))
                            x1 = min(w_f, x0 + larg)
                            y1 = min(h_f, y0 + alt)
                            drawn = Visualizer.draw_results(img, cfg_dict, [], [], x0, y0, x1, y1)
                            ok_enc, enc_jpg = cv2.imencode(".jpg", drawn, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
                            if ok_enc:
                                frame_bytes = enc_jpg.tobytes()
                    except Exception:
                        pass

            yield (
                b"--" + boundary.encode() + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(frame_bytes)).encode() + b"\r\n\r\n"
                + frame_bytes
                + b"\r\n"
            )
            time.sleep(frame_interval)

    return StreamingResponse(
        channel_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )
