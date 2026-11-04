from datetime import datetime
from typing import Any, Dict, List

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


class GenericRtspAdapter(BaseDvrAdapter):
    """
    Adaptador para câmeras IP genéricas que aceitam URLs RTSP diretas.
    """

    def _build_raw_rtsp_url(self, channel_or_id: str, subtype: str = "main") -> str:
        digits = "".join(c for c in str(channel_or_id) if c.isdigit())
        ch = int(digits) if digits else 1
        auth = f"{self.config.username}:{self.config.password}@" if self.config.username else ""
        custom_path = (self.config.metadata or {}).get("rtsp_path")
        if custom_path:
            path = str(custom_path).lstrip("/")
            return f"rtsp://{auth}{self.config.host}:{self.config.rtsp_port}/{path}"
        stream_suffix = "stream1" if subtype == "main" else "stream2"
        return f"rtsp://{auth}{self.config.host}:{self.config.rtsp_port}/live/ch{ch}/{stream_suffix}"

    def get_camera_stream_url(self, channel_or_id: str, subtype: str = "main") -> str:
        return mask_rtsp_url(self._build_raw_rtsp_url(channel_or_id, subtype))

    def test_connection(self) -> ConnectionResult:
        rtsp_ok, latency_ms, msg = probe_tcp_port(self.config.host, self.config.rtsp_port, timeout=2.5)
        if rtsp_ok:
            return ConnectionResult(
                success=True,
                message=f"RTSP Genérico respondendo em {self.config.host}:{self.config.rtsp_port} ({latency_ms}ms)",
                latency_ms=latency_ms,
                status_code=200,
                details={
                    "brand": "generic",
                    "protocol": "RTSP/1.0 TCP",
                    "rtspPortOpen": True,
                },
            )
        return ConnectionResult(
            success=False,
            message=f"Porta RTSP {self.config.rtsp_port} fechada ou host inacessível em {self.config.host} ({msg})",
            latency_ms=latency_ms,
            status_code=504,
            details={"brand": "generic", "rtspPortOpen": False},
        )

    def discover_cameras(self) -> List[CameraDescriptor]:
        rtsp_ok, _, _ = probe_tcp_port(self.config.host, self.config.rtsp_port, timeout=2.0)
        total = max(1, min(self.config.total_channels, 32))
        cameras: List[CameraDescriptor] = []

        for ch in range(1, total + 1):
            cameras.append(
                CameraDescriptor(
                    id=f"rtsp-{self.config.host}-ch-{ch}",
                    channel_number=ch,
                    name=f"{self.config.name} - Stream RTSP #{ch:02d}",
                    stream_url=self.get_camera_stream_url(str(ch), "main"),
                    snapshot_url=f"http://{self.config.host}:{self.config.http_port}/snapshot.jpg",
                    resolution=CameraResolution(width=1280, height=720),
                    fps=12,
                    online=rtsp_ok,
                )
            )
        return cameras

    def capture_snapshot(self, channel_or_id: str) -> ImageCaptureResult:
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

        digits = "".join(c for c in str(channel_or_id) if c.isdigit())
        ch = int(digits) if digits else 1
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
            "brand": "generic",
        }
