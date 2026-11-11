from typing import Any, Optional
from pydantic import BaseModel, Field


class DetectorConfig(BaseModel):
    w: int = Field(default=60, ge=5, le=100, description="Largura percentual da ROI (5% a 100%)")
    h: int = Field(default=50, ge=5, le=100, description="Altura percentual da ROI (5% a 100%)")
    apenas_area: bool = Field(default=False, description="Processar apenas a área de interesse")
    estampado: bool = Field(default=False, description="Ativa motor de tecido estampado (Anomalib)")
    ref_a: Optional[int] = Field(default=None, description="Coordenada 'a' Lab calibrada")
    ref_b: Optional[int] = Field(default=None, description="Coordenada 'b' Lab calibrada")
    linha_orientacao: str = Field(default="vertical", description="Orientação da linha de inspeção ('vertical' ou 'horizontal')")
    linha_posicao_percent: int = Field(default=50, ge=0, le=100, description="Posição da linha de corte (0% a 100%)")
    anomalib_threshold_mult: Optional[float] = Field(default=1.0, ge=0.1, le=5.0, description="Multiplicador de sensibilidade de anomalia")


class DetectorModePayload(BaseModel):
    mode: str = Field(..., description="Modo do detector ('classic' ou 'anomalib')")


class DetectorModeResponse(BaseModel):
    mode: str = Field(..., description="Modo ativo ('classic' ou 'anomalib')")
    estampado: bool = Field(..., description="Indica se está operando no modo estampado")
    backbone_available: Optional[bool] = Field(default=None, description="Indica se os pesos do backbone ResNet18 estão presentes")
    pattern_status: Optional[dict[str, Any]] = Field(default=None, description="Metadados da estampa calibrada")


class CalibratePatternPayload(BaseModel):
    w: int = Field(default=60, ge=5, le=100, description="Largura percentual da ROI")
    h: int = Field(default=50, ge=5, le=100, description="Altura percentual da ROI")
    num_frames: int = Field(default=15, ge=3, le=40, description="Número de frames de tecido bom a capturar")
    interval_ms: int = Field(default=120, ge=40, le=2000, description="Intervalo entre frames capturados em ms")


class CalibratePatternResponse(BaseModel):
    success: bool = Field(..., description="Status da calibração da estampa")
    status: str = Field(..., description="Estado da estampa ('calibrated' ou 'failed')")
    metadata: dict[str, Any] = Field(..., description="Metadados da calibração gerada pelo Anomalib")


class PatternStatusResponse(BaseModel):
    calibrated: bool = Field(..., description="Indica se existe estampa calibrada em memória")
    num_frames: int = Field(default=0, description="Número de amostras utilizadas")
    threshold: float = Field(default=0.0, description="Limiar numérico de detecção de anomalia")
    calibrated_at: Optional[str] = Field(default=None, description="Data/hora ISO da calibração")
    metadata: Optional[dict[str, Any]] = Field(default=None, description="Metadados complementares")


class ClearPatternResponse(BaseModel):
    success: bool = Field(..., description="Status da limpeza do padrão")
    calibrated: bool = Field(default=False, description="Indica se ainda há calibração ativa")


class DefectCountResponse(BaseModel):
    count: int = Field(..., ge=0, description="Total acumulado de defeitos contados na linha")
    defect_count: Optional[int] = Field(default=None, description="Alias para contagem")
    mode: Optional[str] = Field(default=None, description="Modo do detector no momento da contagem")
    estampado: Optional[bool] = Field(default=None, description="Indica se a contagem foi em modo estampado")


class ResetCountResponse(BaseModel):
    success: bool = Field(..., description="Status do reset")
    count: int = Field(default=0, description="Contador zerado")
