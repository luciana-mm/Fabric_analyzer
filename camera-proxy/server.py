import os
import threading
import time
from typing import Optional

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

load_dotenv()

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

app = FastAPI(title="hikvision-camera-proxy", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CameraState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.latest_frame: Optional[bytes] = None
        self.last_frame_ts = 0.0
        self.connected = False
        self.running = True
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def _capture_loop(self) -> None:
        while self.running:
            capture = cv2.VideoCapture(CAMERA_RTSP_URL, cv2.CAP_FFMPEG)
            capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            started_at = time.time()
            self.connected = capture.isOpened()

            if not self.connected:
                capture.release()
                time.sleep(1.0)
                continue

            while self.running:
                ok, frame = capture.read()
                if not ok:
                    self.connected = False
                    break

                encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                encoded_ok, jpg = cv2.imencode(".jpg", frame, encode_params)
                if not encoded_ok:
                    continue

                with self.lock:
                    self.latest_frame = jpg.tobytes()
                    self.last_frame_ts = time.time()
                    self.connected = True

                if time.time() - started_at > CONNECT_TIMEOUT_SECONDS and self.last_frame_ts == 0:
                    self.connected = False
                    break

            capture.release()
            time.sleep(0.5)

    def stop(self) -> None:
        self.running = False
        self.thread.join(timeout=1.0)


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

    samples: list[tuple[float, float, float]] = []
    for row in range(rows):
        for col in range(cols):
            px = int((col + 0.5) * roi.shape[1] / cols)
            py = int((row + 0.5) * roi.shape[0] / rows)

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


@app.post("/capture-robust-sample")
def capture_robust_sample(
    sample_count: int = 5,
    interval_ms: int = 200,
    area_width_percent: float = 60,
    area_height_percent: float = 50,
    sample_points: int = 9,
) -> JSONResponse:
    """
    Capture multiple color samples with robust processing
    Implements outlier removal and weighted averaging
    """
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
            )
            if frame_samples:
                frame_mean = _calculate_robust_mean(frame_samples)
                samples.append(frame_mean)
                luminance_values.append(_calculate_luminance(frame_mean))
                successful_captures += 1
                print(
                    f"[server] Sample {i + 1}: RGB({frame_mean[0]:.1f}, {frame_mean[1]:.1f}, {frame_mean[2]:.1f}) "
                    f"com {len(frame_samples)} subamostras"
                )
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
        "average_luminance": float(average_luminance) / 255.0,  # Normalized to 0-1
        "stability_score": max(0.0, 1.0 - mean_distance / 50.0),  # Rough metric
        "sampling_config": {
            "area_width_percent": area_width_percent,
            "area_height_percent": area_height_percent,
            "sample_points": sample_points,
        },
    }

    print(f"[server] Captura robusta concluída: {result}")
    return JSONResponse(result)


@app.on_event("shutdown")
def shutdown_event() -> None:
    camera_state.stop()
