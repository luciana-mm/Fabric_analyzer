from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

try:
    import runtime_state as rt
    from schemas import (
        DefectCountResponse,
        DetectorConfig,
        DetectorModePayload,
        DetectorModeResponse,
        ResetCountResponse,
    )
except ImportError:
    import backend.runtime_state as rt
    from backend.schemas import (
        DefectCountResponse,
        DetectorConfig,
        DetectorModePayload,
        DetectorModeResponse,
        ResetCountResponse,
    )

router = APIRouter()


@router.post(
    "/detector-config",
    response_model=DetectorConfig,
    tags=["Detector"],
    summary="Atualiza a configuração do detector de defeitos",
)
def update_detector_config(config: DetectorConfig) -> JSONResponse:
    with rt.detector_lock:
        rt.current_detector_config = config
        rt.resolve_detector_for_config(bool(config.estampado))
        data = (
            rt.current_detector_config.model_dump()
            if hasattr(rt.current_detector_config, "model_dump")
            else rt.current_detector_config.dict()
        )
    return JSONResponse(data)


@router.get(
    "/detector-config",
    response_model=DetectorConfig,
    tags=["Detector"],
    summary="Obtém a configuração atual do detector de defeitos",
)
def get_detector_config() -> JSONResponse:
    with rt.detector_lock:
        data = (
            rt.current_detector_config.model_dump()
            if hasattr(rt.current_detector_config, "model_dump")
            else rt.current_detector_config.dict()
        )
        return JSONResponse(data)


@router.get(
    "/detector-mode",
    response_model=DetectorModeResponse,
    tags=["Detector"],
    summary="Retorna o modo ativo do detector e disponibilidade de modelos",
)
def get_detector_mode() -> JSONResponse:
    models_dir = Path(rt.__file__).with_name("models")
    det_status = {}
    if rt.anomalib_detector_instance is not None:
        det_status = rt.anomalib_detector_instance.get_status()
    return JSONResponse(
        {
            "mode": rt.current_detector_mode,
            "estampado": rt.current_detector_config.estampado,
            "backbone_available": (models_dir / "resnet18_backbone.pth").exists(),
            "pattern_status": det_status,
        }
    )


@router.post(
    "/detector-mode",
    response_model=DetectorModeResponse,
    tags=["Detector"],
    summary="Altera o modo ativo do detector ('classic' ou 'anomalib')",
)
def set_detector_mode(payload: DetectorModePayload) -> JSONResponse:
    mode = payload.mode.strip().lower()
    if mode not in ("classic", "anomalib", "yolo"):
        raise HTTPException(status_code=400, detail="mode deve ser 'classic' ou 'anomalib'")

    with rt.detector_lock:
        rt.current_detector_config.estampado = mode in ("anomalib", "yolo")
        rt.resolve_detector_for_config(rt.current_detector_config.estampado)

    return JSONResponse({"mode": rt.current_detector_mode, "estampado": rt.current_detector_config.estampado})


@router.get(
    "/defect-count",
    response_model=DefectCountResponse,
    tags=["Inspeção"],
    summary="Retorna a contagem atual de falhas detectadas",
)
def defect_count() -> JSONResponse:
    return JSONResponse(
        {
            "count": rt.global_tracker.total_count,
            "defect_count": rt.global_tracker.total_count,
            "mode": rt.current_detector_mode,
            "estampado": rt.current_detector_config.estampado,
        }
    )


@router.post(
    "/reset-count",
    response_model=ResetCountResponse,
    tags=["Inspeção"],
    summary="Zera a contagem de falhas (usar ao iniciar um novo teste/rolo)",
)
def reset_count() -> JSONResponse:
    rt.global_tracker.reset()
    return JSONResponse({"success": True, "count": rt.global_tracker.total_count})
