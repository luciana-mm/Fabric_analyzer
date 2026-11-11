from typing import Any, Optional
from pydantic import BaseModel, Field


class RgbColor(BaseModel):
    r: int = Field(..., ge=0, le=255, description="Canal Vermelho (0-255)")
    g: int = Field(..., ge=0, le=255, description="Canal Verde (0-255)")
    b: int = Field(..., ge=0, le=255, description="Canal Azul (0-255)")


class ReferenceColorPayload(BaseModel):
    r: int = Field(..., ge=0, le=255, description="Canal Vermelho (0-255)")
    g: int = Field(..., ge=0, le=255, description="Canal Verde (0-255)")
    b: int = Field(..., ge=0, le=255, description="Canal Azul (0-255)")


class ReferencePalettePayload(BaseModel):
    samples: list[RgbColor] = Field(
        ...,
        min_length=1,
        description="Lista de amostras RGB coletadas na região de interesse",
    )


class ReferencePaletteResponse(BaseModel):
    ref_a: Optional[int] = Field(default=None, description="Coordenada 'a' de referência CIE Lab")
    ref_b: Optional[int] = Field(default=None, description="Coordenada 'b' de referência CIE Lab")
    paleta: Optional[list[list[int]]] = Field(
        default=None, description="Lista de centros de cluster (a, b) da paleta"
    )
    n_cores: int = Field(default=0, description="Número de cores agrupadas na paleta")


class SampleColorResponse(BaseModel):
    r: int = Field(..., ge=0, le=255)
    g: int = Field(..., ge=0, le=255)
    b: int = Field(..., ge=0, le=255)
    hex: str = Field(..., description="Cor em formato hexadecimal #RRGGBB")
    luminance: float = Field(..., description="Luminância normalizada (0.0 a 1.0)")


class RobustSamplingConfig(BaseModel):
    area_width_percent: float = Field(..., ge=0.0, le=100.0)
    area_height_percent: float = Field(..., ge=0.0, le=100.0)
    sample_points: int = Field(..., description="Quantidade de pontos (4, 9 ou 18)")


class RobustSampleResponse(BaseModel):
    success: bool = Field(..., description="Status da captura robusta")
    rgb: RgbColor = Field(..., description="Cor média robusta estimada")
    hex: str = Field(..., description="Cor média no formato hexadecimal")
    samples_captured: int = Field(..., description="Quadros capturados com sucesso")
    samples_total: int = Field(..., description="Total de quadros solicitados")
    samples_used: int = Field(..., description="Total de amostras utilizadas após rejeição de outliers")
    average_luminance: float = Field(..., description="Luminância média normalizada")
    stability_score: float = Field(..., description="Pontuação de estabilidade da amostragem (0.0 a 1.0)")
    sampling_config: RobustSamplingConfig = Field(..., description="Parâmetros utilizados na amostragem")
    samples: Optional[list[RgbColor]] = Field(default=None, description="Amostras brutas de pontos individuais")
