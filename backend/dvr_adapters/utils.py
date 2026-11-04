import re
import socket
import time
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np


def mask_rtsp_url(url: str) -> str:
    """
    Mascara credenciais em URLs RTSP ou HTTP para exibição segura em logs e respostas da API.
    Exemplo: rtsp://admin:12345@192.168.1.64:554/... -> rtsp://admin:****@192.168.1.64:554/...
    """
    if not url:
        return url
    return re.sub(r"://([^:/@\s]+):([^@\s]+)@", r"://\1:****@", url)


def probe_tcp_port(host: str, port: int, timeout: float = 2.5) -> Tuple[bool, float, str]:
    """
    Realiza um teste real de handshake TCP na porta especificada e mede a latência em ms.
    """
    start = time.perf_counter()
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            latency_ms = round((time.perf_counter() - start) * 1000.0, 2)
            return True, latency_ms, f"TCP handshake OK em {host}:{port}"
    except socket.timeout:
        latency_ms = round((time.perf_counter() - start) * 1000.0, 2)
        return False, latency_ms, f"Timeout ({timeout}s) ao conectar em {host}:{port}"
    except OSError as exc:
        latency_ms = round((time.perf_counter() - start) * 1000.0, 2)
        return False, latency_ms, f"Falha de conexão em {host}:{port} ({exc})"


def capture_frame_via_opencv(
    rtsp_url: str, jpeg_quality: int = 85
) -> Tuple[Optional[bytes], int, int]:
    """
    Extrai um único keyframe/frame de uma stream RTSP usando OpenCV.
    Retorna (jpeg_bytes, width, height) ou (None, 0, 0) em caso de falha.
    """
    capture = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    try:
        if not capture.isOpened():
            return None, 0, 0
        ok, frame = capture.read()
        if not ok or frame is None:
            return None, 0, 0
        height, width = frame.shape[:2]
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality]
        encoded_ok, jpg = cv2.imencode(".jpg", frame, encode_params)
        if not encoded_ok:
            return None, 0, 0
        return jpg.tobytes(), width, height
    finally:
        capture.release()


def load_or_generate_mock_frame(
    channel: int = 1, width: int = 640, height: int = 480
) -> Tuple[bytes, int, int]:
    """
    Carrega um frame real do banco de padrões de tecido (reference_patterns)
    ou gera uma textura têxtil sintética com metadados de canal para o MockDvrAdapter.
    """
    frames_dir = (
        Path(__file__).resolve().parent.parent
        / "reference_patterns"
        / "active_pattern"
        / "frames"
    )
    frame = None

    if frames_dir.exists():
        jpg_files = sorted(frames_dir.glob("*.jpg"))
        if jpg_files:
            chosen = jpg_files[(max(1, channel) - 1) % len(jpg_files)]
            loaded = cv2.imread(str(chosen), cv2.IMREAD_COLOR)
            if loaded is not None:
                frame = loaded

    if frame is None:
        # Gera uma trama têxtil sintética caso não haja imagens no disco
        frame = np.full((height, width, 3), (42, 48, 56), dtype=np.uint8)
        step = 16
        for y in range(0, height, step):
            cv2.line(frame, (0, y), (width, y), (58, 66, 76), 1)
        for x in range(0, width, step):
            cv2.line(frame, (x, 0), (x, height), (58, 66, 76), 1)

    h, w = frame.shape[:2]
    overlay = frame.copy()
    timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S")
    label = f"SIMULADOR CFTV - CH {channel:02d} | {timestamp_str}"
    cv2.rectangle(overlay, (10, 10), (min(w - 10, 460), 44), (15, 23, 42), -1)
    cv2.putText(
        overlay,
        label,
        (20, 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.52,
        (56, 189, 248),
        1,
        cv2.LINE_AA,
    )

    _, jpg = cv2.imencode(".jpg", overlay, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    return jpg.tobytes(), w, h
