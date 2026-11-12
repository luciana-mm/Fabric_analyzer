import time

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response, StreamingResponse

from detector import Visualizer
from dvr_adapters import DvrAdapterFactory
from dvr_types import DvrBrand, DvrDeviceConfig

try:
    import runtime_state as rt
    from schemas import (
        DvrActiveCameraResponse,
        DvrDiscoverResponse,
        DvrEventsResponse,
        DvrMonitorStatusResponse,
        DvrSetActiveCameraPayload,
        DvrSetStreamProfilePayload,
    )
except ImportError:
    import backend.runtime_state as rt
    from backend.schemas import (
        DvrActiveCameraResponse,
        DvrDiscoverResponse,
        DvrEventsResponse,
        DvrMonitorStatusResponse,
        DvrSetActiveCameraPayload,
        DvrSetStreamProfilePayload,
    )

router = APIRouter()


@router.post(
    "/dvr/test-connection",
    tags=["CFTV"],
    summary="Testa conectividade e credenciais de um dispositivo DVR/Câmera",
)
def dvr_test_connection(payload: DvrDeviceConfig) -> JSONResponse:
    adapter = DvrAdapterFactory.create(payload)
    result = adapter.test_connection()
    data = result.model_dump(by_alias=True) if hasattr(result, "model_dump") else result.dict(by_alias=True)
    return JSONResponse(data)


@router.post(
    "/dvr/discover",
    response_model=DvrDiscoverResponse,
    tags=["CFTV"],
    summary="Descobre canais e streams disponíveis em um DVR",
)
def dvr_discover_cameras(payload: DvrDeviceConfig) -> JSONResponse:
    adapter = DvrAdapterFactory.create(payload)
    cameras = adapter.discover_cameras()
    items = [
        (cam.model_dump(by_alias=True) if hasattr(cam, "model_dump") else cam.dict(by_alias=True))
        for cam in cameras
    ]
    return JSONResponse({"cameras": items})


@router.get("/dvr/mock/snapshot", tags=["CFTV"], summary="Snapshot sintético do simulador CFTV")
def dvr_mock_snapshot(channel: int = 1) -> Response:
    mock_cfg = DvrDeviceConfig(
        name="Simulador CFTV",
        brand=DvrBrand.MOCK,
        host="127.0.0.1",
        username="admin",
        password="",
        total_channels=max(1, channel),
    )
    adapter = DvrAdapterFactory.create(mock_cfg)
    snap = adapter.capture_snapshot(str(channel))
    return Response(
        content=snap.buffer,
        media_type=snap.mime_type,
        headers={"Cache-Control": "no-store"},
    )


@router.get(
    "/dvr/monitor/status",
    response_model=DvrMonitorStatusResponse,
    tags=["CFTV"],
    summary="Resumo de saúde e circuit-breaker dos dispositivos monitorados",
)
def dvr_monitor_status() -> JSONResponse:
    summary = rt.stream_session_manager.get_status_summary(
        active_camera_connected=rt.camera_state.connected,
        last_frame_ts=rt.camera_state.last_frame_ts,
    )
    summary["activeOperatorCamera"] = rt.camera_state.get_active_info()
    return JSONResponse(summary)


@router.post("/dvr/monitor/check-now", tags=["CFTV"], summary="Executa verificação imediata de saúde dos DVRs")
def dvr_monitor_check_now() -> JSONResponse:
    devices = rt.stream_session_manager.run_check_now()
    events = rt.stream_session_manager.get_events(limit=30)
    return JSONResponse({"devices": devices, "events": events})


@router.get(
    "/dvr/monitor/events",
    response_model=DvrEventsResponse,
    tags=["CFTV"],
    summary="Lista eventos recentes de conexão/reconexão de câmeras",
)
def dvr_monitor_events(limit: int = 50) -> JSONResponse:
    events = rt.stream_session_manager.get_events(limit=limit)
    return JSONResponse({"events": events})


@router.post("/dvr/monitor/register", tags=["CFTV"], summary="Registra um dispositivo DVR/Câmera no Health Monitor")
def dvr_monitor_register(payload: DvrDeviceConfig) -> JSONResponse:
    entry = rt.stream_session_manager.register_device(payload)
    return JSONResponse({"device": entry})


@router.post("/dvr/capture-snapshot", tags=["CFTV"], summary="Captura snapshot sob demanda de um canal DVR")
def dvr_capture_snapshot_endpoint(
    payload: DvrDeviceConfig, channel: str = "1"
) -> JSONResponse:
    snap_data = rt.stream_session_manager.capture_snapshot_on_demand(payload, channel_or_id=channel)
    return JSONResponse(snap_data)


@router.post(
    "/dvr/stream-profile",
    tags=["CFTV"],
    summary="Altera o perfil de stream (main/sub) no monitor",
)
def dvr_set_stream_profile(payload: DvrSetStreamProfilePayload) -> JSONResponse:
    device_id = payload.deviceId
    subtype = payload.subtype
    updated = rt.stream_session_manager.set_stream_subtype(device_id, subtype)
    if not updated:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado no monitor")
    return JSONResponse({"device": updated})


@router.get(
    "/dvr/active-camera",
    response_model=DvrActiveCameraResponse,
    tags=["CFTV"],
    summary="Retorna qual câmera está atualmente alimentando o Painel do Operário",
)
def dvr_get_active_camera() -> JSONResponse:
    return JSONResponse(rt.camera_state.get_active_info())


@router.post(
    "/dvr/active-camera",
    tags=["CFTV"],
    summary="Troca dinamicamente em tempo de execução a câmera que alimenta o operário e a IA",
)
def dvr_set_active_camera(payload: DvrSetActiveCameraPayload) -> JSONResponse:
    camera_id = payload.cameraId or ""
    camera_name = payload.cameraName or "Câmera Operário"
    channel = payload.channel or "1"
    raw_brand = (payload.brand or "generic").lower()
    brand_str = "generic" if raw_brand in ("generic_rtsp", "generic") else raw_brand
    explicit_url = (payload.streamUrl or "").strip()

    if explicit_url and "***" not in explicit_url:
        stream_url = explicit_url
    elif brand_str == "mock":
        stream_url = f"mock://127.0.0.1/channel/{channel}"
    else:
        try:
            raw_pwd = payload.password or ""
            if raw_pwd.lower() in ("configured", "none", "null"):
                raw_pwd = ""
            if not raw_pwd and brand_str != "droidcam":
                raw_pwd = rt.resolve_dvr_password(
                    payload.dvrId or "",
                    payload.host or rt.CAMERA_IP,
                    int(payload.rtspPort or rt.CAMERA_RTSP_PORT),
                    brand_str,
                )
            dvr_cfg = DvrDeviceConfig(
                id=payload.dvrId or "",
                name=camera_name,
                brand=DvrBrand(brand_str),
                host=payload.host or rt.CAMERA_IP,
                rtsp_port=int(payload.rtspPort or (4747 if brand_str == "droidcam" else rt.CAMERA_RTSP_PORT)),
                http_port=int(payload.httpPort or (4747 if brand_str == "droidcam" else 80)),
                sdk_port=int(payload.sdkPort or 8000),
                username=payload.username or "admin",
                password=raw_pwd,
                total_channels=max(1, int(channel) if channel.isdigit() else 1),
            )
            adapter = DvrAdapterFactory.create(dvr_cfg)
            if hasattr(adapter, "_build_raw_stream_url"):
                stream_url = adapter._build_raw_stream_url("main")
            elif hasattr(adapter, "_build_raw_rtsp_url"):
                stream_url = adapter._build_raw_rtsp_url(channel, "main")
            else:
                stream_url = adapter.get_camera_stream_url(channel, "main")
        except Exception as err:
            raise HTTPException(status_code=400, detail=f"Configuração de câmera inválida: {err}")

    info = rt.camera_state.switch_camera(
        stream_url=stream_url,
        camera_id=camera_id,
        camera_name=camera_name,
        brand=brand_str,
        channel=channel,
    )
    return JSONResponse({"activeCamera": info})


@router.get(
    "/dvr/channel-stream.mjpg",
    tags=["CFTV"],
    summary="Stream MJPEG individual por canal para o Mosaico Multi-Câmera",
)
def dvr_channel_stream_mjpeg(
    camId: str = "",
    dvrId: str = "",
    name: str = "Câmera",
    brand: str = "hikvision",
    host: str = "127.0.0.1",
    port: int = 554,
    httpPort: int = 80,
    user: str = "admin",
    channel: str = "1",
    mode: str = "raw",
) -> StreamingResponse:
    brand_clean = "generic" if brand.lower() in ("generic_rtsp", "generic") else brand.lower()
    password = rt.resolve_dvr_password(dvrId, host, port, brand_clean)

    if brand_clean == "mock":
        stream_url = f"mock://127.0.0.1/channel/{channel}"
    else:
        try:
            dvr_cfg = DvrDeviceConfig(
                id=dvrId or f"{brand_clean}-{host}:{port}",
                name=name,
                brand=DvrBrand(brand_clean),
                host=host,
                rtsp_port=int(port),
                http_port=int(httpPort),
                username=user or "admin",
                password=password,
                total_channels=max(1, int(channel) if str(channel).isdigit() else 1),
            )
            adapter = DvrAdapterFactory.create(dvr_cfg)
            if hasattr(adapter, "_build_raw_stream_url"):
                stream_url = adapter._build_raw_stream_url("main")
            elif hasattr(adapter, "_build_raw_rtsp_url"):
                stream_url = adapter._build_raw_rtsp_url(str(channel), "main")
            else:
                stream_url = adapter.get_camera_stream_url(str(channel), "main")
        except Exception:
            stream_url = f"rtsp://{user}:{password}@{host}:{port}/Streaming/Channels/{channel}"

    worker_key = f"{brand_clean}:{host}:{port}:{channel}"
    boundary = "frame"

    def channel_generator():
        frame_interval = 1.0 / rt.OUTPUT_FPS if rt.OUTPUT_FPS > 0 else 0.08
        while True:
            is_same_as_operator = (
                (camId and camId == rt.camera_state.active_camera_id)
                or (rt.camera_state.active_stream_url == stream_url)
                or (
                    host
                    and host != "127.0.0.1"
                    and host in rt.camera_state.active_stream_url
                    and str(channel) == str(rt.camera_state.active_channel)
                )
            )
            if is_same_as_operator:
                rt.channel_stream_pool.stop_worker(worker_key)
                with rt.camera_state.lock:
                    op_frame = rt.camera_state.latest_frame
                    op_age = time.time() - rt.camera_state.last_frame_ts if rt.camera_state.last_frame_ts else 999.0

                if op_frame is not None and op_age <= 6.0:
                    if mode == "analyzed" and rt.pipeline_state.latest_analyzed_frame is not None:
                        frame_bytes = rt.pipeline_state.latest_analyzed_frame
                    else:
                        frame_bytes = op_frame
                else:
                    frame_bytes = rt.camera_state.build_status_frame(
                        "Conectando ao stream da camera..."
                        if op_frame is None
                        else "Sinal interrompido - reconectando..."
                    )
            else:
                worker = rt.channel_stream_pool.get_or_create(
                    worker_key=worker_key,
                    stream_url=stream_url,
                    camera_name=name,
                    brand=brand_clean,
                    host=host,
                    port=port,
                    channel=str(channel),
                )
                worker.touch()
                with worker.lock:
                    frame_bytes = worker.latest_frame
                    age = time.time() - worker.last_frame_ts if worker.last_frame_ts else 999.0

                if frame_bytes is None or age > 8.0:
                    frame_bytes = worker.build_status_frame(
                        "Conectando ao stream da camera..." if age > 8.0 else "Aguardando video..."
                    )
                elif mode == "analyzed":
                    try:
                        arr = np.frombuffer(frame_bytes, dtype=np.uint8)
                        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                        if img is not None:
                            with rt.detector_lock:
                                cfg_dict = (
                                    rt.current_detector_config.model_dump()
                                    if hasattr(rt.current_detector_config, "model_dump")
                                    else rt.current_detector_config.dict()
                                )
                            h_f, w_f = img.shape[:2]
                            larg = max(2, int(w_f * (cfg_dict.get("w", 60) / 100.0)))
                            alt = max(2, int(h_f * (cfg_dict.get("h", 50) / 100.0)))
                            x0 = max(0, int(w_f / 2 - larg / 2))
                            y0 = max(0, int(h_f / 2 - alt / 2))
                            x1 = min(w_f, x0 + larg)
                            y1 = min(h_f, y0 + alt)
                            drawn = Visualizer.draw_results(img, cfg_dict, [], [], x0, y0, x1, y1)
                            ok_enc, enc_jpg = cv2.imencode(
                                ".jpg", drawn, [int(cv2.IMWRITE_JPEG_QUALITY), rt.JPEG_QUALITY]
                            )
                            if ok_enc:
                                frame_bytes = enc_jpg.tobytes()
                    except Exception:
                        pass

            yield (
                b"--" + boundary.encode() + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(frame_bytes)).encode() + b"\r\n\r\n"
                + frame_bytes
                + b"\r\n"
            )
            time.sleep(frame_interval)

    return StreamingResponse(
        channel_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )
