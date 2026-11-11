from typing import Any, Optional
from pydantic import BaseModel, Field


class DvrSetStreamProfilePayload(BaseModel):
    deviceId: str = Field(..., description="ID do DVR ou câmera")
    subtype: str = Field(default="main", description="Perfil de stream ('main' ou 'sub')")


class DvrSetActiveCameraPayload(BaseModel):
    cameraId: Optional[str] = Field(default="", description="ID da câmera selecionada")
    cameraName: Optional[str] = Field(default="Câmera Operário", description="Nome descritivo da câmera")
    channel: Optional[str] = Field(default="1", description="Número do canal no DVR")
    brand: Optional[str] = Field(default="generic", description="Marca do DVR (hikvision, intelbras, dahua, onvif, droidcam, mock, generic)")
    streamUrl: Optional[str] = Field(default="", description="URL RTSP/HTTP explícita se fornecida")
    dvrId: Optional[str] = Field(default="", description="ID do DVR pai se houver")
    host: Optional[str] = Field(default=None, description="IP ou hostname do DVR")
    rtspPort: Optional[int] = Field(default=None, description="Porta RTSP do DVR")
    httpPort: Optional[int] = Field(default=None, description="Porta HTTP do DVR")
    sdkPort: Optional[int] = Field(default=None, description="Porta SDK do DVR")
    username: Optional[str] = Field(default="admin", description="Usuário do DVR")
    password: Optional[str] = Field(default="", description="Senha da câmera/DVR")


class DvrActiveCameraResponse(BaseModel):
    stream_url: str = Field(..., description="URL ativa de streaming no operário")
    camera_id: str = Field(..., description="ID da câmera ativa")
    camera_name: str = Field(..., description="Nome descritivo da câmera")
    brand: str = Field(..., description="Marca da câmera ativa")
    channel: str = Field(..., description="Canal ativo")


class DvrDiscoverResponse(BaseModel):
    cameras: list[dict[str, Any]] = Field(..., description="Lista de canais/câmeras descobertos no DVR")


class DvrMonitorStatusResponse(BaseModel):
    devices: list[dict[str, Any]] = Field(..., description="Dispositivos monitorados pelo health check")
    events: list[dict[str, Any]] = Field(..., description="Eventos recentes de conexão")


class DvrEventsResponse(BaseModel):
    events: list[dict[str, Any]] = Field(..., description="Lista de logs/eventos de streaming")
