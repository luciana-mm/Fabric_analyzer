import time
from datetime import datetime
from typing import Any, Dict, List

from dvr_types import (
    BaseDvrAdapter,
    CameraDescriptor,
    CameraResolution,
    ConnectionResult,
    ImageCaptureResult,
)
from .utils import load_or_generate_mock_frame


class MockDvrAdapter(BaseDvrAdapter):
    """
    Adaptador Simulador / Mock para desenvolvimento e homologação sem hardware físico.
    Utiliza frames reais de tecido em `reference_patterns/` ou texturas sintéticas.
    """

    def test_connection(self) -> ConnectionResult:
        start = time.perf_counter()
        time.sleep(0.015)  # Simula latência de rede local (~15ms)
        latency_ms = round((time.perf_counter() - start) * 1000.0, 2)
        return ConnectionResult(
            success=True,
            message=f"Simulador CFTV '{self.config.name}' pronto ({self.config.total_channels} canais virtuais)",
            latency_ms=latency_ms,
            status_code=200,
            details={
                "brand": "mock",
                "model": "FabricSim-NVR-4K",
                "firmware": "v2.4.0-sim",
                "activeChannels": self.config.total_channels,
                "protocol": "Simulated Frame Loop (reference_patterns)",
            },
        )

    def discover_cameras(self) -> List[CameraDescriptor]:
        cameras: List[CameraDescriptor] = []
        total = max(1, min(self.config.total_channels, 32))
        channel_roles = [
            "Inspeção Superior Rolo A",
            "Inspeção Lateral Ourela",
            "Saída de Calandra",
            "Mesa Revisora Iluminada",
        ]
        for ch in range(1, total + 1):
            role_label = channel_roles[(ch - 1) % len(channel_roles)]
            cameras.append(
                CameraDescriptor(
                    id=f"mock-ch-{ch}",
                    channel_number=ch,
                    name=f"Câmera Simulada {ch:02d} ({role_label})",
                    stream_url=f"mock://{self.config.host}/channels/{ch}/main",
                    snapshot_url=f"/dvr/mock/snapshot?channel={ch}",
                    resolution=CameraResolution(width=1280, height=720),
                    fps=12,
                    online=True,
                )
            )
        return cameras

    def get_camera_stream_url(self, channel_or_id: str, subtype: str = "main") -> str:
        ch = self._parse_channel(channel_or_id)
        return f"mock://{self.config.host}/channels/{ch}/{subtype}"

    def capture_snapshot(self, channel_or_id: str) -> ImageCaptureResult:
        ch = self._parse_channel(channel_or_id)
        jpg_bytes, width, height = load_or_generate_mock_frame(channel=ch)
        return ImageCaptureResult(
            camera_id=str(channel_or_id),
            mime_type="image/jpeg",
            buffer=jpg_bytes,
            width=width,
            height=height,
            captured_at=datetime.utcnow(),
        )

    def get_device_status(self) -> Dict[str, Any]:
        return {
            "online": True,
            "uptime": 86400,
            "activeChannels": self.config.total_channels,
            "brand": "mock",
        }

    @staticmethod
    def _parse_channel(channel_or_id: str) -> int:
        digits = "".join(ch for ch in str(channel_or_id) if ch.isdigit())
        return int(digits) if digits else 1
