import urllib.request
from datetime import datetime
from typing import Any, Dict, List
import cv2
import numpy as np

from dvr_types import (
    BaseDvrAdapter,
    CameraDescriptor,
    CameraResolution,
    ConnectionResult,
    ImageCaptureResult,
)
from .utils import (
    capture_frame_via_opencv,
    load_or_generate_mock_frame,
    mask_rtsp_url,
    probe_tcp_port,
)


class DroidCamAdapter(BaseDvrAdapter):
    """
    Adaptador dedicado para o aplicativo DroidCam / IP Webcam em celulares Android e iOS.
    Conecta via HTTP MJPEG na porta padrão 4747 (`http://{ip}:4747/video`).
    """

    def _resolve_port(self) -> int:
        if self.config.rtsp_port and self.config.rtsp_port != 554:
            return int(self.config.rtsp_port)
        if self.config.http_port and self.config.http_port != 80:
            return int(self.config.http_port)
        return 4747

    def _build_raw_stream_url(self, subtype: str = "main") -> str:
        port = self._resolve_port()
        auth = ""
        if self.config.username and self.config.password and self.config.password != "configured":
            auth = f"{self.config.username}:{self.config.password}@"
        path = "/video" if subtype == "main" else "/mjpegfeed?640x480"
        return f"http://{auth}{self.config.host}:{port}{path}"

    def get_camera_stream_url(self, channel_or_id: str, subtype: str = "main") -> str:
        return mask_rtsp_url(self._build_raw_stream_url(subtype))

    def test_connection(self) -> ConnectionResult:
        port = self._resolve_port()
        ok, latency_ms, msg = probe_tcp_port(self.config.host, port, timeout=2.5)
        if ok:
            return ConnectionResult(
                success=True,
                message=f"DroidCam (Celular) conectado em http://{self.config.host}:{port}/video ({latency_ms}ms)",
                latency_ms=latency_ms,
                status_code=200,
                details={
                    "brand": "droidcam",
                    "protocol": "HTTP MJPEG Stream",
                    "port": port,
                    "streamUrl": f"http://{self.config.host}:{port}/video",
                },
            )
        return ConnectionResult(
            success=False,
            message=f"DroidCam inacessível em {self.config.host}:{port}. Verifique se o app DroidCam está aberto no Wi-Fi ({msg})",
            latency_ms=latency_ms,
            status_code=504,
            details={"brand": "droidcam", "port": port, "reachable": False},
        )

    def discover_cameras(self) -> List[CameraDescriptor]:
        port = self._resolve_port()
        ok, _, _ = probe_tcp_port(self.config.host, port, timeout=2.0)
        return [
            CameraDescriptor(
                id=f"droidcam-{self.config.host}-{port}",
                channel_number=1,
                name=f"{self.config.name} (DroidCam Wi-Fi)",
                stream_url=self.get_camera_stream_url("1", "main"),
                snapshot_url=f"http://{self.config.host}:{port}/cam/1/frame.jpg",
                resolution=CameraResolution(width=1280, height=720),
                fps=15,
                online=ok,
            )
        ]

    def capture_snapshot(self, channel_or_id: str) -> ImageCaptureResult:
        port = self._resolve_port()
        snap_url = f"http://{self.config.host}:{port}/cam/1/frame.jpg"

        # 1. Tenta endpoint de frame único do DroidCam
        try:
            with urllib.request.urlopen(snap_url, timeout=2.5) as resp:
                data = resp.read()
                arr = np.frombuffer(data, dtype=np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if img is not None:
                    h, w = img.shape[:2]
                    return ImageCaptureResult(
                        camera_id=str(channel_or_id),
                        mime_type="image/jpeg",
                        buffer=data,
                        width=w,
                        height=h,
                        captured_at=datetime.utcnow(),
                    )
        except Exception:
            pass

        # 2. Tenta extrair 1 frame do stream /video via OpenCV
        jpg_bytes, w, h = capture_frame_via_opencv(self._build_raw_stream_url("main"))
        if jpg_bytes is not None:
            return ImageCaptureResult(
                camera_id=str(channel_or_id),
                mime_type="image/jpeg",
                buffer=jpg_bytes,
                width=w,
                height=h,
                captured_at=datetime.utcnow(),
            )

        # 3. Fallback sintético caso o celular esteja desconectado
        fallback_bytes, fw, fh = load_or_generate_mock_frame(channel=1)
        return ImageCaptureResult(
            camera_id=str(channel_or_id),
            mime_type="image/jpeg",
            buffer=fallback_bytes,
            width=fw,
            height=fh,
            captured_at=datetime.utcnow(),
        )

    def get_device_status(self) -> Dict[str, Any]:
        port = self._resolve_port()
        ok, latency_ms, _ = probe_tcp_port(self.config.host, port, timeout=2.0)
        return {
            "online": ok,
            "latencyMs": latency_ms,
            "activeChannels": 1 if ok else 0,
            "brand": "droidcam",
        }
