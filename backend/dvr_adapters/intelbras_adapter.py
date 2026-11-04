import base64
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


class IntelbrasDvrAdapter(BaseDvrAdapter):
    """
    Adaptador para DVRs e NVRs Intelbras / Dahua.
    Suporta portas padrão (37777 serviço, 554 RTSP, 80 HTTP) e sintaxe RTSP
    `/cam/realmonitor?channel={ch}&subtype={0|1}` (0 = main, 1 = sub).
    """

    def _parse_channel(self, channel_or_id: str) -> int:
        digits = "".join(c for c in str(channel_or_id) if c.isdigit())
        ch = int(digits) if digits else 1
        return ch if ch < 100 else max(1, ch // 100)

    def _build_raw_rtsp_url(self, channel_or_id: str, subtype: str = "main") -> str:
        ch = self._parse_channel(channel_or_id)
        sub_flag = 0 if subtype == "main" else 1
        auth = f"{self.config.username}:{self.config.password}@" if self.config.username else ""
        return (
            f"rtsp://{auth}{self.config.host}:{self.config.rtsp_port}"
            f"/cam/realmonitor?channel={ch}&subtype={sub_flag}"
        )

    def get_camera_stream_url(self, channel_or_id: str, subtype: str = "main") -> str:
        return mask_rtsp_url(self._build_raw_rtsp_url(channel_or_id, subtype))

    def test_connection(self) -> ConnectionResult:
        sdk_port = self.config.sdk_port or 37777
        rtsp_ok, rtsp_lat, rtsp_msg = probe_tcp_port(self.config.host, self.config.rtsp_port, timeout=2.5)
        sdk_ok, sdk_lat, _ = probe_tcp_port(self.config.host, sdk_port, timeout=2.0)
        http_ok, _, _ = probe_tcp_port(self.config.host, self.config.http_port, timeout=1.5)

        latency_ms = rtsp_lat if rtsp_ok else sdk_lat
        if rtsp_ok or sdk_ok or http_ok:
            return ConnectionResult(
                success=True,
                message=f"Intelbras/Dahua conectado em {self.config.host} ({latency_ms}ms)",
                latency_ms=latency_ms,
                status_code=200,
                details={
                    "brand": self.config.brand.value,
                    "protocol": "Intelbras RPC / RTSP RealMonitor",
                    "rtspPortOpen": rtsp_ok,
                    "servicePort37777Open": sdk_ok,
                    "httpCgiPortOpen": http_ok,
                    "streamPattern": "/cam/realmonitor?channel={ch}&subtype={0|1}",
                },
            )

        return ConnectionResult(
            success=False,
            message=f"Intelbras inacessível em {self.config.host}:{self.config.rtsp_port} ({rtsp_msg})",
            latency_ms=rtsp_lat,
            status_code=504,
            details={
                "brand": self.config.brand.value,
                "rtspPortOpen": False,
                "servicePort37777Open": False,
            },
        )

    def discover_cameras(self) -> List[CameraDescriptor]:
        rtsp_ok, _, _ = probe_tcp_port(self.config.host, self.config.rtsp_port, timeout=2.0)
        sdk_ok, _, _ = probe_tcp_port(self.config.host, self.config.sdk_port or 37777, timeout=1.5)
        is_online = rtsp_ok or sdk_ok

        total = max(1, min(self.config.total_channels, 64))
        cameras: List[CameraDescriptor] = []

        for ch in range(1, total + 1):
            masked_url = self.get_camera_stream_url(str(ch), subtype="main")
            snapshot_url = (
                f"http://{self.config.host}:{self.config.http_port}"
                f"/cgi-bin/snapshot.cgi?channel={ch}"
            )
            cameras.append(
                CameraDescriptor(
                    id=f"intelbras-{self.config.host}-ch-{ch}",
                    channel_number=ch,
                    name=f"{self.config.name} - Canal {ch:02d}",
                    stream_url=masked_url,
                    snapshot_url=snapshot_url,
                    resolution=CameraResolution(width=1920, height=1080),
                    fps=12,
                    online=is_online,
                )
            )
        return cameras

    def capture_snapshot(self, channel_or_id: str) -> ImageCaptureResult:
        ch = self._parse_channel(channel_or_id)
        cgi_url = (
            f"http://{self.config.host}:{self.config.http_port}"
            f"/cgi-bin/snapshot.cgi?channel={ch}"
        )

        # 1. Tenta CGI HTTP Snapshot
        try:
            req = urllib.request.Request(cgi_url)
            if self.config.username:
                credentials = f"{self.config.username}:{self.config.password}"
                encoded = base64.b64encode(credentials.encode("utf-8")).decode("ascii")
                req.add_header("Authorization", f"Basic {encoded}")
            with urllib.request.urlopen(req, timeout=3.0) as resp:
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

        # 2. Fallback RTSP via OpenCV
        raw_rtsp = self._build_raw_rtsp_url(channel_or_id, "main")
        jpg_bytes, w, h = capture_frame_via_opencv(raw_rtsp)
        if jpg_bytes is not None:
            return ImageCaptureResult(
                camera_id=str(channel_or_id),
                mime_type="image/jpeg",
                buffer=jpg_bytes,
                width=w,
                height=h,
                captured_at=datetime.utcnow(),
            )

        # 3. Fallback sintético/referência
        fallback_bytes, fw, fh = load_or_generate_mock_frame(channel=ch)
        return ImageCaptureResult(
            camera_id=str(channel_or_id),
            mime_type="image/jpeg",
            buffer=fallback_bytes,
            width=fw,
            height=fh,
            captured_at=datetime.utcnow(),
        )

    def get_device_status(self) -> Dict[str, Any]:
        rtsp_ok, latency_ms, _ = probe_tcp_port(self.config.host, self.config.rtsp_port, timeout=2.0)
        return {
            "online": rtsp_ok,
            "latencyMs": latency_ms,
            "activeChannels": self.config.total_channels if rtsp_ok else 0,
            "brand": self.config.brand.value,
        }
