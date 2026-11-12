"""
server.py — Ponto de entrada FastAPI do Fabric Analyzer Backend.

Responsável por instanciar a aplicação FastAPI, configurar CORS, registrar
os APIRouters modulares (`stream`, `analysis`, `calibration`, `dvr`) e gerenciar
o ciclo de vida dos workers em segundo plano.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    import runtime_state as rt
    from routers import (
        analysis_router,
        calibration_router,
        dvr_router,
        stream_router,
    )
except ImportError:
    import backend.runtime_state as rt
    from backend.routers import (
        analysis_router,
        calibration_router,
        dvr_router,
        stream_router,
    )

# Re-exporta estados e singletons principais para compatibilidade com scripts e testes
camera_state = rt.camera_state
pipeline_state = rt.pipeline_state
channel_stream_pool = rt.channel_stream_pool
stream_session_manager = rt.stream_session_manager
current_detector_config = rt.current_detector_config
detector_lock = rt.detector_lock
global_tracker = rt.global_tracker
classic_detector = rt.classic_detector
color_reference_lock = rt.color_reference_lock

app = FastAPI(
    title="Fabric Analyzer - Backend & Computer Vision API",
    version="2.0.0",
    description="API de visão computacional (OpenCV e Anomalib), streaming MJPEG e gerenciamento de câmeras/DVRs.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stream_router)
app.include_router(analysis_router)
app.include_router(calibration_router)
app.include_router(dvr_router)


@app.on_event("shutdown")
def shutdown_event() -> None:
    rt.camera_state.stop()
    rt.channel_stream_pool.stop_all()
    rt.stream_session_manager.stop()
