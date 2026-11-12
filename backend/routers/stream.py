import logging
import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response, StreamingResponse

from detector import to_grayscale

try:
    import runtime_state as rt
    from schemas import HealthResponse
except ImportError:
    import backend.runtime_state as rt
    from backend.schemas import HealthResponse

_log = logging.getLogger("backend.routers.stream")

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    tags=["Sistema"],
    summary="Verifica a integridade do serviço e da câmera",
)
def health() -> JSONResponse:
    age_seconds = max(0.0, time.time() - rt.camera_state.last_frame_ts) if rt.camera_state.last_frame_ts else None
    active_info = rt.camera_state.get_active_info()
    return JSONResponse(
        {
            "connected": rt.camera_state.connected,
            "last_frame_age_seconds": age_seconds,
            "camera_ip": rt.CAMERA_IP,
            "camera_channel": active_info["channel"],
            "active_camera": active_info,
        }
    )


@router.get("/stream.mjpg", tags=["Streaming"], summary="Stream MJPEG bruto da câmera ativa do operário")
def stream_mjpeg() -> StreamingResponse:
    boundary = "frame"

    def frame_generator():
        frame_interval = 1.0 / rt.OUTPUT_FPS if rt.OUTPUT_FPS > 0 else 0.08
        rt.camera_state.register_client()
        try:
            while True:
                with rt.camera_state.lock:
                    frame = rt.camera_state.latest_frame
                    age = time.time() - rt.camera_state.last_frame_ts if rt.camera_state.last_frame_ts else 999.0

                if frame is None or age > 6.0:
                    frame = rt.camera_state.build_status_frame(
                        "Conectando ao stream da camera..."
                        if frame is None
                        else "Sinal interrompido - reconectando..."
                    )

                yield (
                    b"--" + boundary.encode() + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
                    + frame
                    + b"\r\n"
                )
                time.sleep(frame_interval)
        finally:
            rt.camera_state.unregister_client()

    return StreamingResponse(
        frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@router.get(
    "/stream-analyzed.mjpg",
    tags=["Streaming"],
    summary="Stream MJPEG analisado em tempo real pelo motor de Visão Computacional",
)
def stream_analyzed_mjpeg(
    w: Optional[int] = None,
    h: Optional[int] = None,
    apenas_area: Optional[bool] = None,
    estampado: Optional[bool] = None,
    linha_orientacao: Optional[str] = None,
    linha_posicao_percent: Optional[int] = None,
) -> StreamingResponse:
    with rt.detector_lock:
        if w is not None:
            rt.current_detector_config.w = max(5, min(100, int(w)))
        if h is not None:
            rt.current_detector_config.h = max(5, min(100, int(h)))
        if apenas_area is not None:
            rt.current_detector_config.apenas_area = bool(apenas_area)
        else:
            rt.current_detector_config.apenas_area = False
        if estampado is not None:
            rt.current_detector_config.estampado = bool(estampado)
        if linha_orientacao in ("vertical", "horizontal"):
            rt.current_detector_config.linha_orientacao = linha_orientacao
        if linha_posicao_percent is not None:
            rt.current_detector_config.linha_posicao_percent = max(0, min(100, int(linha_posicao_percent)))

    boundary = "frame"

    def analyzed_frame_generator():
        frame_interval = 1.0 / rt.OUTPUT_FPS if rt.OUTPUT_FPS > 0 else 0.08
        rt.camera_state.register_client()
        try:
            while True:
                with rt.camera_state.lock:
                    age = time.time() - rt.camera_state.last_frame_ts if rt.camera_state.last_frame_ts else 999.0
                with rt.pipeline_state.lock:
                    jpg_bytes = rt.pipeline_state.latest_analyzed_frame

                if jpg_bytes is None or age > 6.0:
                    jpg_bytes = rt.camera_state.build_status_frame(
                        "Conectando ao stream da camera..."
                        if jpg_bytes is None
                        else "Sinal interrompido - reconectando..."
                    )

                try:
                    yield (
                        b"--" + boundary.encode() + b"\r\n"
                        b"Content-Type: image/jpeg\r\n"
                        b"Content-Length: " + str(len(jpg_bytes)).encode() + b"\r\n\r\n"
                        + jpg_bytes
                        + b"\r\n"
                    )
                except Exception as e:
                    _log.debug("Cliente desconectado do stream analisado: %s", e)
                    break

                time.sleep(frame_interval)
        finally:
            rt.camera_state.unregister_client()

    return StreamingResponse(
        analyzed_frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@router.get("/stream-grayscale.mjpg", tags=["Streaming"], summary="Stream MJPEG em tons de cinza")
def stream_grayscale_mjpeg() -> StreamingResponse:
    boundary = "frame"

    def grayscale_frame_generator():
        frame_interval = 1.0 / rt.OUTPUT_FPS if rt.OUTPUT_FPS > 0 else 0.08
        rt.camera_state.register_client()
        try:
            while True:
                gray_bytes = rt.camera_state.get_grayscale_jpeg(to_grayscale)
                if gray_bytes is None:
                    time.sleep(0.1)
                    continue

                yield (
                    b"--" + boundary.encode() + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(gray_bytes)).encode() + b"\r\n\r\n"
                    + gray_bytes
                    + b"\r\n"
                )
                time.sleep(frame_interval)
        finally:
            rt.camera_state.unregister_client()

    return StreamingResponse(
        grayscale_frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@router.get("/snapshot.jpg", tags=["Streaming"], summary="Captura um frame JPEG instantâneo da câmera ativa")
def snapshot() -> Response:
    with rt.camera_state.lock:
        frame_bytes = rt.camera_state.latest_frame

    if frame_bytes is None:
        raise HTTPException(status_code=503, detail="Nenhum frame disponivel no momento")

    return Response(content=frame_bytes, media_type="image/jpeg")
