import os
import json
import threading
import time
from typing import Optional
from pathlib import Path
import subprocess
import io
import logging

import cv2
import numpy as np
from detector import analyze_fabric, to_grayscale, get_defect_count, reset_defect_count
from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi import Query
import random 


load_dotenv()

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
CAMERA_IP = os.getenv("CAMERA_IP", "192.168.1.64")
CAMERA_RTSP_PORT = int(os.getenv("CAMERA_RTSP_PORT", "554"))
CAMERA_USER = os.getenv("CAMERA_USER", "admin")
CAMERA_PASSWORD = os.getenv("CAMERA_PASSWORD", "Ratokalugi12")
CAMERA_CHANNEL = os.getenv("CAMERA_CHANNEL", "101")
CAMERA_RTSP_URL = os.getenv(
    "CAMERA_RTSP_URL",
    f"rtsp://{CAMERA_USER}:{CAMERA_PASSWORD}@{CAMERA_IP}:{CAMERA_RTSP_PORT}/Streaming/Channels/{CAMERA_CHANNEL}",
)
OUTPUT_FPS = float(os.getenv("OUTPUT_FPS", "12"))
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "80"))
CONNECT_TIMEOUT_SECONDS = float(os.getenv("CONNECT_TIMEOUT_SECONDS", "5"))
COLOR_REFERENCE_PATH = Path(
    os.getenv(
        "COLOR_REFERENCE_PATH",
        str(Path(__file__).with_name("calibrated-color-reference.json")),
    )
)

# Fallback to using ffmpeg subprocess for more robust H.264 handling
USE_FFMPEG_FALLBACK = os.getenv("USE_FFMPEG_FALLBACK", "1") != "0"

logging.basicConfig(level=logging.INFO)
_log = logging.getLogger("camera-proxy")


def _load_color_reference() -> tuple[Optional[int], Optional[int], Optional[list]]:
    try:
        saved = json.loads(COLOR_REFERENCE_PATH.read_text(encoding="utf-8"))
        ref_a = int(saved["ref_a"]) if "ref_a" in saved else None
        ref_b = int(saved["ref_b"]) if "ref_b" in saved else None
        paleta_raw = saved.get("paleta")
        paleta = None
        if isinstance(paleta_raw, list) and paleta_raw:
            paleta = [(int(p[0]), int(p[1])) for p in paleta_raw]
        return ref_a, ref_b, paleta
    except (FileNotFoundError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        pass
    return None, None, None



color_reference_lock = threading.Lock()
saved_ref_a, saved_ref_b, saved_paleta = _load_color_reference()
N_CORES_PALETA = 3

app = FastAPI(title="hikvision-camera-proxy", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/reference-palette")
def save_reference_palette(payload: dict = Body(...)) -> JSONResponse:
    """
    Recebe uma lista de amostras RGB coletadas na ROI (ex: vários pontos
    do xadrez), converte pra Lab e agrupa em N_CORES_PALETA clusters via
    k-means. Salva a paleta resultante como referência do tecido.
    """
    global saved_ref_a, saved_ref_b, saved_paleta

    samples = payload.get("samples")
    if not isinstance(samples, list) or len(samples) == 0:
        raise HTTPException(status_code=400, detail="Informe 'samples': lista de {r,g,b}")

    lab_points = []
    for s in samples:
        try:
            r, g, b = int(s["r"]), int(s["g"]), int(s["b"])
        except (KeyError, TypeError, ValueError):
            continue
        if not all(0 <= v <= 255 for v in (r, g, b)):
            continue
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

    reference = {"ref_a": ref_a, "ref_b": ref_b, "paleta": [list(p) for p in paleta]}

    try:
        COLOR_REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = COLOR_REFERENCE_PATH.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(reference), encoding="utf-8")
        temporary_path.replace(COLOR_REFERENCE_PATH)
    except OSError as error:
        _log.error("Não foi possível salvar a paleta de cor: %s", error)
        raise HTTPException(status_code=500, detail="Falha ao salvar paleta de cor")

    with color_reference_lock:
        saved_ref_a, saved_ref_b, saved_paleta = ref_a, ref_b, paleta

    return JSONResponse({"ref_a": ref_a, "ref_b": ref_b, "paleta": paleta, "n_cores": len(paleta)})

class CameraState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.latest_frame: Optional[bytes] = None
        self.last_frame_ts = 0.0
        self.connected = False
        self.running = True
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()
        self._ffmpeg_thread: Optional[threading.Thread] = None

    def _capture_loop(self) -> None:
        backoff = 1.0
        while self.running:
            try:
                # Prefer OpenCV capture first for simple cases
                _log.info("Attempting OpenCV capture...")
                capture = cv2.VideoCapture(CAMERA_RTSP_URL, cv2.CAP_FFMPEG)
                # slightly larger buffersize to reduce packet-loss noise
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
                    _log.warning("OpenCV failed to open RTSP stream, will retry or fallback")
                    capture.release()
                    # try ffmpeg fallback if enabled
                    if USE_FFMPEG_FALLBACK:
                        self._start_ffmpeg_fallback()
                        return
                    time.sleep(min(backoff, 10.0))
                    backoff = min(backoff * 2, 10.0)
                    continue

                backoff = 1.0

                while self.running:
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
                time.sleep(0.5)
            except Exception as e:
                _log.exception("Unexpected error in capture loop: %s", e)
                time.sleep(1.0)

    def stop(self) -> None:
        self.running = False
        self.thread.join(timeout=1.0)
        if self._ffmpeg_thread and self._ffmpeg_thread.is_alive():
            # thread will exit when running is False
            self._ffmpeg_thread.join(timeout=1.0)

    def _start_ffmpeg_fallback(self) -> None:
        if self._ffmpeg_thread and self._ffmpeg_thread.is_alive():
            return
        self._ffmpeg_thread = threading.Thread(target=self._ffmpeg_loop, daemon=True)
        self._ffmpeg_thread.start()

    def _ffmpeg_loop(self) -> None:
        """Start ffmpeg subprocess to read RTSP via TCP and stream MJPEG frames to stdout.
        This is generally more robust for H.264 streams from cameras.
        """
        _log.info("Starting ffmpeg fallback loop")
        backoff = 1.0
        while self.running:
            cmd = [
                "ffmpeg",
                "-rtsp_transport",
                "tcp",
                "-i",
                CAMERA_RTSP_URL,
                "-f",
                "mjpeg",
                "-q:v",
                "5",
                "-r",
                str(int(OUTPUT_FPS)),
                "pipe:1",
            ]

            try:
                _log.info("Launching ffmpeg: %s", " ".join(cmd))
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

                stdout = proc.stdout
                buffer = b""

                while self.running:
                    if stdout is None:
                        break
                    chunk = stdout.read(4096)
                    if not chunk:
                        # process ended or no data
                        _log.warning("ffmpeg stdout closed or no data")
                        break
                    buffer += chunk

                    # find JPEG start/end markers
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

                try:
                    proc.kill()
                except Exception:
                    pass

            except FileNotFoundError:
                _log.error("ffmpeg not found in PATH. Install ffmpeg to use fallback.")
                break
            except Exception as e:
                _log.exception("ffmpeg loop error: %s", e)

            if not self.running:
                break
            _log.info("ffmpeg fallback reconnect backoff %s seconds", backoff)
            time.sleep(backoff)
            backoff = min(backoff * 2, 30.0)


camera_state = CameraState()


@app.get("/health")
def health() -> JSONResponse:
    age_seconds = max(0.0, time.time() - camera_state.last_frame_ts) if camera_state.last_frame_ts else None
    return JSONResponse(
        {
            "connected": camera_state.connected,
            "last_frame_age_seconds": age_seconds,
            "camera_ip": CAMERA_IP,
            "camera_channel": CAMERA_CHANNEL,
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

            if frame is None:
                time.sleep(0.1)
                continue

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

# AQUI: O w: int e h: int garantem que o Python não trate como texto e quebre a imagem
@app.get("/stream-analyzed.mjpg")
def stream_analyzed_mjpeg(
    w: int = Query(60, ge=1, le=100, description="Largura da área de análise em %"),
    h: int = Query(50, ge=1, le=100, description="Altura da área de análise em %"),
    apenas_area: bool = Query(False),
    estampado: bool = Query(False),
    ref_r: Optional[int] = Query(None, ge=0, le=255),
    ref_g: Optional[int] = Query(None, ge=0, le=255),
    ref_b: Optional[int] = Query(None, ge=0, le=255),
) -> StreamingResponse:
    global saved_ref_a, saved_ref_b, saved_paleta

    boundary = "frame"
    with color_reference_lock:
        ref_a = saved_ref_a
        ref_b = saved_ref_b
        paleta = saved_paleta

    if None not in (ref_r, ref_g, ref_b):
        reference_rgb = np.uint8([[[ref_r, ref_g, ref_b]]])
        reference_lab = cv2.cvtColor(reference_rgb, cv2.COLOR_RGB2LAB)
        ref_a = int(reference_lab[0, 0, 1])
        ref_b = int(reference_lab[0, 0, 2])
        paleta = [(ref_a, ref_b)]  # override manual vira paleta de 1 cor

    def analyzed_frame_generator():
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
                    processed_frame = analyze_fabric(
                        frame,
                        w,
                        h,
                        apenas_area=apenas_area,
                        paleta=paleta,
                        ref_a=ref_a,
                        ref_b=ref_b,
                        estampado=estampado,
                    )
                    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                    encoded_ok, jpg = cv2.imencode(".jpg", processed_frame, encode_params)

                    if encoded_ok:
                        jpg_bytes = jpg.tobytes()
                        yield (
                            b"--" + boundary.encode() + b"\r\n"
                            b"Content-Type: image/jpeg\r\n"
                            b"Content-Length: " + str(len(jpg_bytes)).encode() + b"\r\n\r\n"
                            + jpg_bytes
                            + b"\r\n"
                        )
            except Exception as e:
                _log.error(f"Erro ao processar frame analisado (w={w}, h={h}): {e}")

            time.sleep(frame_interval)

    return StreamingResponse(
        analyzed_frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@app.post("/reference-color")
def save_reference_color(payload: dict = Body(...)) -> JSONResponse:
    """Converte a cor RGB calibrada para Lab OpenCV e a persiste no proxy."""
    global saved_ref_a, saved_ref_b, saved_paleta

    try:
        ref_r = int(payload["r"])
        ref_g = int(payload["g"])
        ref_b = int(payload["b"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Informe r, g e b entre 0 e 255")

    if not all(0 <= value <= 255 for value in (ref_r, ref_g, ref_b)):
        raise HTTPException(status_code=400, detail="r, g e b devem estar entre 0 e 255")

    reference_rgb = np.uint8([[[ref_r, ref_g, ref_b]]])
    reference_lab = cv2.cvtColor(reference_rgb, cv2.COLOR_RGB2LAB)
    ref_a = int(reference_lab[0, 0, 1])
    ref_b = int(reference_lab[0, 0, 2])
    paleta = [(ref_a, ref_b)]
    reference = {"ref_a": ref_a, "ref_b": ref_b, "paleta": [list(p) for p in paleta]}

    try:
        COLOR_REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = COLOR_REFERENCE_PATH.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(reference), encoding="utf-8")
        temporary_path.replace(COLOR_REFERENCE_PATH)
    except OSError as error:
        _log.error("Não foi possível salvar a referência de cor: %s", error)
        raise HTTPException(status_code=500, detail="Falha ao salvar referência de cor")

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

@app.get("/defect-count")
def defect_count() -> JSONResponse:
    """Retorna a contagem atual de falhas detectadas"""
    return JSONResponse({"count": get_defect_count()})


@app.post("/reset-count")
def reset_count() -> JSONResponse:
    """Zera a contagem de falhas (usar ao iniciar um novo teste/rolo)"""
    reset_defect_count()
    return JSONResponse({"success": True, "count": get_defect_count()})

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

    print(f"[server] Removed {len(colors) - len(cleaned)}/{len(colors)} outliers")
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

@app.get("/reference-palette")
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
@app.post("/capture-robust-sample")
def capture_robust_sample(
    sample_count: int = 5,
    interval_ms: int = 200,
    area_width_percent: float = 60,
    area_height_percent: float = 50,
    sample_points: int = 9,
    include_samples: bool = False,
    pixel_puro: bool = False,
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

    print(
        "[server] Iniciando captura robusta: "
        f"{sample_count} amostras, intervalo {interval_ms}ms, "
        f"area {area_width_percent:.1f}%x{area_height_percent:.1f}%, "
        f"pontos {sample_points}"
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
        except Exception as e:
            print(f"[server] Erro na amostra {i + 1}: {e}")

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

    print(f"[server] Captura robusta concluída: {result}")
    return JSONResponse(result)


@app.on_event("shutdown")
def shutdown_event() -> None:
    camera_state.stop()
