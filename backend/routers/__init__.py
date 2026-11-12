from .analysis import router as analysis_router
from .calibration import router as calibration_router
from .dvr import router as dvr_router
from .stream import router as stream_router

__all__ = [
    "stream_router",
    "analysis_router",
    "calibration_router",
    "dvr_router",
]
