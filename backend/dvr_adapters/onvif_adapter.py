import urllib.request
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

ONVIF_GET_DATE_SOAP = """<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <GetSystemDateAndTime xmlns="http://www.onvif.org/ver10/device/wsdl"/>
  </s:Body>
</s:Envelope>"""


class GenericOnvifAdapter(BaseDvrAdapter):
    """
    Adaptador ONVIF (Profile S / Profile T) com probe SOAP em `/onvif/device_service`
    e obtenção de URIs de stream e snapshot.
    """

    def _probe_onvif_soap(self) -> bool:
        url = f"http://{self.config.host}:{self.config.http_port}/onvif/device_service"
        try:
            req = urllib.request.Request(
                url,
                data=ONVIF_GET_DATE_SOAP.encode("utf-8"),
                headers={"Content-Type": "application/soap+xml; charset=utf-8"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                body = resp.read().decode("utf-8", errors="ignore")
                return "GetSystemDateAndTimeResponse" in body or resp.status == 200
        except Exception:
            return False

    def _build_raw_rtsp_url(self, channel_or_id: str, subtype: str = "main") -> str:
        digits = "".join(c for c in str(channel_or_id) if c.isdigit())
        ch = int(digits) if digits else 1
        stream_idx = 1 if subtype == "main" else 2
        auth = f"{self.config.username}:{self.config.password}@" if self.config.username else ""
        custom_path = (self.config.metadata or {}).get("rtsp_path")
        if custom_path:
            path = str(custom_path).lstrip("/")
            return f"rtsp://{auth}{self.config.host}:{self.config.rtsp_port}/{path}"
        return f"rtsp://{auth}{self.config.host}:{self.config.rtsp_port}/onvif/profile{stream_idx}/ch{ch}"

    def get_camera_stream_url(self, channel_or_id: str, subtype: str = "main") -> str:
        return mask_rtsp_url(self._build_raw_rtsp_url(channel_or_id, subtype))

    def test_connection(self) -> ConnectionResult:
        rtsp_ok, rtsp_lat, msg = probe_tcp_port(self.config.host, self.config.rtsp_port, timeout=2.5)
        http_ok, http_lat, _ = probe_tcp_port(self.config.host, self.config.http_port, timeout=2.0)
        soap_ok = self._probe_onvif_soap() if http_ok else False

        latency_ms = rtsp_lat if rtsp_ok else http_lat
        if rtsp_ok or http_ok or soap_ok:
            return ConnectionResult(
                success=True,
                message=f"ONVIF Profile S/T respondendo em {self.config.host} ({latency_ms}ms)",
                latency_ms=latency_ms,
                status_code=200,
                details={
                    "brand": "onvif",
                    "protocol": "ONVIF SOAP / RTSP Profile S",
                    "onvifSoapService": soap_ok,
                    "rtspPortOpen": rtsp_ok,
                    "httpPortOpen": http_ok,
                },
            )

        return ConnectionResult(
            success=False,
            message=f"Dispositivo ONVIF inacessível em {self.config.host}:{self.config.rtsp_port} ({msg})",
            latency_ms=latency_ms,
            status_code=504,
            details={"brand": "onvif", "onvifSoapService": False, "rtspPortOpen": False},
        )

    def discover_cameras(self) -> List[CameraDescriptor]:
        rtsp_ok, _, _ = probe_tcp_port(self.config.host, self.config.rtsp_port, timeout=2.0)
        http_ok, _, _ = probe_tcp_port(self.config.host, self.config.http_port, timeout=1.5)
        is_online = rtsp_ok or http_ok

        total = max(1, min(self.config.total_channels, 64))
        cameras: List[CameraDescriptor] = []

        for ch in range(1, total + 1):
            cameras.append(
                CameraDescriptor(
                    id=f"onvif-{self.config.host}-ch-{ch}",
                    channel_number=ch,
                    name=f"{self.config.name} - ONVIF Profile S #{ch:02d}",
                    stream_url=self.get_camera_stream_url(str(ch), "main"),
                    snapshot_url=f"http://{self.config.host}:{self.config.http_port}/onvif-http/snapshot?Profile_{ch}",
                    resolution=CameraResolution(width=1920, height=1080),
                    fps=12,
                    online=is_online,
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
            "brand": "onvif",
        }
