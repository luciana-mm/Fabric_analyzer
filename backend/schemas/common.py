from typing import Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    connected: bool = Field(..., description="Indica se a fonte de vídeo está conectada")
    last_frame_age_seconds: Optional[float] = Field(default=None, description="Idade do último frame recebido em segundos")
    camera_ip: str = Field(default="", description="IP da câmera padrão configurada")
    camera_channel: str = Field(default="1", description="Canal ativo da câmera")
    active_camera: Optional[dict[str, Any]] = Field(default=None, description="Informações da câmera ativa no momento")


class MessageResponse(BaseModel):
    success: bool = Field(..., description="Indica se a operação foi bem sucedida")
    message: str = Field(..., description="Mensagem descritiva")
    details: Optional[dict[str, Any]] = Field(default=None, description="Detalhes adicionais")
