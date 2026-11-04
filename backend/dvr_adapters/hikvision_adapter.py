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


class HikvisionDvrAdapter(BaseDvrAdapter):
    """
    Adaptador para DVRs, NVRs e Câmeras IP Hikvision.
    Suporta protocolo HTTP ISAPI e sintaxe RTSP `/Streaming/Channels/{ch}01` (main) e `{ch}02` (sub).
    """

    def _format_channel_code(self, channel_or_id: str, subtype: str = "main") -> int:
        digits = "".join(c for c in str(channel_or_id) if c.isdigit())
        ch_num = int(digits) if digits else 1
        stream_suffix = 1 if subtype == "main" else 2
        if ch_num >= 100:
            base_ch = ch_num // 100
            return base_ch * 100 + stream_suffix
        return ch_num * 100 + stream_suffix

    def _build_raw_rtsp_url(self, channel_or_id: str, subtype: str = "main") -> str:
        ch_code = self._format_channel_code(channel_or_id, subtype)
        auth = f"{self.config.username}:{self.config.password}@" if self.config.username else ""
        return f"rtsp://{auth}{self.config.host}:{self.config.rtsp_port}/Streaming/Channels/{ch_code}"

    def get_camera_stream_url(self, channel_or_id: str, subtype: str = "main") -> str:
        return mask_rtsp_url(self._build_raw_rtsp_url(channel_or_id, subtype))

    def test_connection(self) -> ConnectionResult:
        rtsp_ok, latency_ms, msg = probe_tcp_port(self.config.host, self.config.rtsp_port, timeout=2.5)
        http_ok, _, _ = probe_tcp_port(self.config.host, self.config.http_port, timeout=1.5)
        sdk_port = self.config.sdk_port or 8000
        sdk_ok, _, _ = probe_tcp_port(self.config.host, sdk_port, timeout=1.5)

        if rtsp_ok or http_ok:
            return ConnectionResult(
                success=True,
                message=f"Hikvision conectado em {self.config.host}:{self.config.rtsp_port} ({latency_ms}ms)",
                latency_ms=latency_ms,
                status_code=200,
                details={
                    "brand": "hikvision",
                    "protocol": "ISAPI / RTSP",
                    "rtspPortOpen": rtsp_ok,
                    "httpIsapiPortOpen": http_ok,
                    "sdkPortOpen": sdk_ok,
                    "mainStreamPattern": "/Streaming/Channels/{ch}01",
                    "subStreamPattern": "/Streaming/Channels/{ch}02",
                },
            )

        return ConnectionResult(
            success=False,
            message=f"Hikvision inacessível em {self.config.host}:{self.config.rtsp_port} ({msg})",
            latency_ms=latency_ms,
            status_code=504,
            details={
                "brand": "hikvision",
                "rtspPortOpen": False,
                "httpIsapiPortOpen": False,
                "sdkPortOpen": sdk_ok,
            },
        )

    def discover_cameras(self) -> List[CameraDescriptor]:
        rtsp_ok, _, _ = probe_tcp_port(self.config.host, self.config.rtsp_port, timeout=2.0)
        total = max(1, min(self.config.total_channels, 64))
        cameras: List[CameraDescriptor] = []

        for ch in range(1, total + 1):
            ch_code = ch * 100 + 1
            masked_rtsp = self.get_camera_stream_url(str(ch), subtype="main")
            snapshot_url = (
                f"http://{self.config.host}:{self.config.http_port}"
                f"/ISAPI/Streaming/channels/{ch_code}/picture"
            )
            cameras.append(
                CameraDescriptor(
                    id=f"hikvision-{self.config.host}-ch-{ch_code}",
                    channel_number=ch_code if total == 1 else ch,
                    name=f"{self.config.name} - Canal {ch_code if total == 1 else ch:02d}",
                    stream_url=masked_rtsp,
                    snapshot_url=snapshot_url,
                    resolution=CameraResolution(width=1920, height=1080),
                    fps=12,
                    online=rtsp_ok,
                )
            )
        return cameras

    def capture_snapshot(self, channel_or_id: str) -> ImageCaptureResult:
        ch_code = self._format_channel_code(channel_or_id, "main")
        isapi_url = (
            f"http://{self.config.host}:{self.config.http_port}"
            f"/ISAPI/Streaming/channels/{ch_code}/picture"
        )

        # 1. Tenta captura rápida via HTTP ISAPI
        try:
            req = urllib.request.Request(isapi_url)
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

        # 2. Fallback para extração de keyframe RTSP via OpenCV
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

        # 3. Fallback sintético/referência caso câmera física esteja desligada
        fallback_bytes, fw, fh = load_or_generate_mock_frame(channel=ch_code // 100)
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
            "brand": "hikvision",
        }
