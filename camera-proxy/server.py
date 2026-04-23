import os
import threading
import time
from typing import Optional

import cv2
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

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


@app.on_event("shutdown")
def shutdown_event() -> None:
    camera_state.stop()
