from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class DvrBrand(str, Enum):
    HIKVISION = "hikvision"
    INTELBRAS = "intelbras"
    DAHUA = "dahua"
    ONVIF = "onvif"
    GENERIC = "generic"
    MOCK = "mock"


class DeviceConnectionStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    CONNECTING = "connecting"
    ERROR = "error"


class CameraResolution(BaseModel):
    width: int
    height: int


class CameraDescriptor(BaseModel):
    id: str
    channel_number: int = Field(default=1, alias="channelNumber")
    name: str
    stream_url: Optional[str] = Field(default=None, alias="streamUrl")
    snapshot_url: Optional[str] = Field(default=None, alias="snapshotUrl")
    resolution: Optional[CameraResolution] = None
    fps: Optional[int] = 12
    online: bool = True

    class Config:
        populate_by_name = True


class ConnectionResult(BaseModel):
    success: bool
    message: str
    latency_ms: float = Field(default=0.0, alias="latencyMs")
    status_code: Optional[int] = Field(default=None, alias="statusCode")
    details: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True


class ImageCaptureResult(BaseModel):
    camera_id: str = Field(alias="cameraId")
    mime_type: str = Field(default="image/jpeg", alias="mimeType")
    buffer: bytes
    width: int
    height: int
    captured_at: datetime = Field(default_factory=datetime.utcnow, alias="capturedAt")

    class Config:
        populate_by_name = True


class DvrDeviceConfig(BaseModel):
    id: Optional[str] = None
    name: str
    brand: DvrBrand
    host: str
    rtsp_port: int = 554
    http_port: int = 80
    sdk_port: Optional[int] = None
    username: str
    password: str
    total_channels: int = 1
    metadata: Optional[Dict[str, Any]] = None


class BaseDvrAdapter(ABC):
    """
    Interface abstrata comum para adaptadores de fabricantes de CFTV (Adapter Pattern).
    Desacopla o pipeline de visão das peculiaridades de protocolo de cada fabricante.
    """

    def __init__(self, config: DvrDeviceConfig):
        self.config = config

    @abstractmethod
    def test_connection(self) -> ConnectionResult:
        """Testa conectividade e credenciais com o dispositivo de CFTV."""
        pass

    @abstractmethod
    def discover_cameras(self) -> List[CameraDescriptor]:
        """Varre e retorna a lista de canais/câmeras disponíveis no DVR/NVR."""
        pass

    @abstractmethod
    def get_camera_stream_url(self, channel_or_id: str, subtype: str = "main") -> str:
        """Gera a URL de stream (RTSP/WebRTC) segura para o canal especificado."""
        pass

    @abstractmethod
    def capture_snapshot(self, channel_or_id: str) -> ImageCaptureResult:
        """Captura um snapshot estático (JPEG) de alta fidelidade para calibração ou inspeção."""
        pass

    @abstractmethod
    def get_device_status(self) -> Dict[str, Any]:
        """Obtém status de saúde, uptime e canais ativos."""
        pass
