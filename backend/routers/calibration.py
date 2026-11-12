import logging
import random
import time

import cv2
import numpy as np
from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import JSONResponse

try:
    import runtime_state as rt
    from db import set_runtime_setting
    from schemas import (
        CalibratePatternPayload,
        CalibratePatternResponse,
        ClearPatternResponse,
        PatternStatusResponse,
        ReferenceColorPayload,
        ReferencePalettePayload,
        ReferencePaletteResponse,
        RobustSampleResponse,
        SampleColorResponse,
    )
except ImportError:
    import backend.runtime_state as rt
    from backend.db import set_runtime_setting
    from backend.schemas import (
        CalibratePatternPayload,
        CalibratePatternResponse,
        ClearPatternResponse,
        PatternStatusResponse,
        ReferenceColorPayload,
        ReferencePalettePayload,
        ReferencePaletteResponse,
        RobustSampleResponse,
        SampleColorResponse,
    )

_log = logging.getLogger("backend.routers.calibration")

router = APIRouter()


@router.post(
    "/reference-palette",
    response_model=ReferencePaletteResponse,
    tags=["Calibração"],
    summary="Salva paleta de cores de referência do tecido",
)
def save_reference_palette(payload: ReferencePalettePayload) -> JSONResponse:
    samples = payload.samples
    if not samples:
        raise HTTPException(status_code=400, detail="Informe 'samples': lista de {r,g,b}")

    lab_points = []
    for s in samples:
        r, g, b = s.r, s.g, s.b
        rgb_arr = np.uint8([[[r, g, b]]])
        lab_arr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2LAB)
        lab_points.append([float(lab_arr[0, 0, 1]), float(lab_arr[0, 0, 2])])

    if not lab_points:
        raise HTTPException(status_code=400, detail="Nenhuma amostra valida em 'samples'")

    data = np.array(lab_points, dtype=np.float32)
    k = min(rt.N_CORES_PALETA, len(data))

    if k == 1:
        centers = np.array([[float(np.mean(data[:, 0])), float(np.mean(data[:, 1]))]])
    else:
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
        _, _, centers = cv2.kmeans(data, k, None, criteria, 5, cv2.KMEANS_PP_CENTERS)

    paleta = [(int(round(c[0])), int(round(c[1]))) for c in centers]
    ref_a = paleta[0][0]
    ref_b = paleta[0][1]

    reference = {
        "ref_a": ref_a,
        "ref_b": ref_b,
        "paleta": [list(p) for p in paleta],
        "n_cores": len(paleta),
    }

    with rt.color_reference_lock:
        rt.saved_ref_a, rt.saved_ref_b, rt.saved_paleta = ref_a, ref_b, paleta
        set_runtime_setting("color_reference", reference)

    return JSONResponse(reference)


@router.get(
    "/reference-palette",
    response_model=ReferencePaletteResponse,
    tags=["Calibração"],
    summary="Obtém a paleta de cor de referência atualmente carregada",
)
def get_reference_palette() -> JSONResponse:
    with rt.color_reference_lock:
        paleta = rt.saved_paleta
        ref_a = rt.saved_ref_a
        ref_b = rt.saved_ref_b
    return JSONResponse(
        {
            "ref_a": ref_a,
            "ref_b": ref_b,
            "paleta": paleta,
            "n_cores": len(paleta) if paleta else 0,
        }
    )


@router.post(
    "/reference-color",
    tags=["Calibração"],
    summary="Converte a cor RGB calibrada para Lab OpenCV e a persiste",
)
def save_reference_color(payload: ReferenceColorPayload) -> JSONResponse:
    ref_r = payload.r
    ref_g = payload.g
    ref_b = payload.b

    reference_rgb = np.uint8([[[ref_r, ref_g, ref_b]]])
    reference_lab = cv2.cvtColor(reference_rgb, cv2.COLOR_RGB2LAB)
    ref_a = int(reference_lab[0, 0, 1])
    ref_b = int(reference_lab[0, 0, 2])
    paleta = [(ref_a, ref_b)]
    reference = {"ref_a": ref_a, "ref_b": ref_b, "paleta": [list(p) for p in paleta]}

    with rt.color_reference_lock:
        rt.saved_ref_a, rt.saved_ref_b, rt.saved_paleta = ref_a, ref_b, paleta
        set_runtime_setting("color_reference", reference)

    return JSONResponse({"ref_a": ref_a, "ref_b": ref_b})


@router.get(
    "/sample-color",
    response_model=SampleColorResponse,
    tags=["Calibração"],
    summary="Amostra a cor média no centro do frame atual da câmera",
)
def sample_color() -> JSONResponse:
    frame = rt.decode_latest_frame()
    height, width = frame.shape[:2]

    center_x = width // 2
    center_y = height // 2
    sample_size = 10

    x0 = max(0, center_x - sample_size)
    x1 = min(width, center_x + sample_size)
    y0 = max(0, center_y - sample_size)
    y1 = min(height, center_y + sample_size)

    region = frame[y0:y1, x0:x1]
    if region.size == 0:
        raise HTTPException(status_code=500, detail="Regiao de amostragem invalida")

    b, g, r = region.mean(axis=(0, 1))
    rgb = {
        "r": int(round(r)),
        "g": int(round(g)),
        "b": int(round(b)),
    }
    hex_value = f"#{rgb['r']:02x}{rgb['g']:02x}{rgb['b']:02x}"

    return JSONResponse(
        {
            "rgb": rgb,
            "hex": hex_value,
            "sample_center": {"x": center_x, "y": center_y},
            "sample_size": sample_size * 2,
        }
    )


def _calculate_color_distance(color1: tuple, color2: tuple) -> float:
    r_diff = color1[0] - color2[0]
    g_diff = color1[1] - color2[1]
    b_diff = color1[2] - color2[2]
    return float(np.sqrt(r_diff**2 + g_diff**2 + b_diff**2))


def _remove_color_outliers(colors: list) -> list:
    if len(colors) <= 3:
        return colors

    mean_r = np.mean([c[0] for c in colors])
    mean_g = np.mean([c[1] for c in colors])
    mean_b = np.mean([c[2] for c in colors])
    mean_color = (mean_r, mean_g, mean_b)

    distances = [_calculate_color_distance(c, mean_color) for c in colors]
    q1 = float(np.percentile(distances, 25))
    q3 = float(np.percentile(distances, 75))
    iqr = q3 - q1
    threshold = q3 + 1.5 * iqr

    cleaned = [c for i, c in enumerate(colors) if distances[i] <= threshold]
    return cleaned if cleaned else colors


def _calculate_robust_mean(colors: list) -> tuple:
    if not colors:
        return (128, 128, 128)
    if len(colors) == 1:
        return colors[0]

    mean_r = np.mean([c[0] for c in colors])
    mean_g = np.mean([c[1] for c in colors])
    mean_b = np.mean([c[2] for c in colors])
    initial_mean = (mean_r, mean_g, mean_b)

    total_weight = 0.0
    weighted_r, weighted_g, weighted_b = 0.0, 0.0, 0.0

    for color in colors:
        distance = _calculate_color_distance(color, initial_mean)
        weight = 1.0 / (1.0 + distance * 5)

        weighted_r += color[0] * weight
        weighted_g += color[1] * weight
        weighted_b += color[2] * weight
        total_weight += weight

    if total_weight > 0:
        return (
            weighted_r / total_weight,
            weighted_g / total_weight,
            weighted_b / total_weight,
        )

    return initial_mean


def _calculate_luminance(rgb: tuple) -> float:
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def _get_sampling_grid(sample_points: int) -> tuple[int, int]:
    if sample_points == 4:
        return (2, 2)
    if sample_points == 9:
        return (3, 3)
    return (3, 6)


def _collect_area_samples(
    frame: np.ndarray,
    area_width_percent: float,
    area_height_percent: float,
    sample_points: int,
    pixel_puro: bool = False,
) -> list[tuple[float, float, float]]:
    height, width = frame.shape[:2]
    center_x = width // 2
    center_y = height // 2

    roi_width = max(2, int(width * (area_width_percent / 100.0)))
    roi_height = max(2, int(height * (area_height_percent / 100.0)))

    x0 = max(0, center_x - roi_width // 2)
    x1 = min(width, center_x + roi_width // 2)
    y0 = max(0, center_y - roi_height // 2)
    y1 = min(height, center_y + roi_height // 2)

    roi = frame[y0:y1, x0:x1]
    if roi.size == 0:
        return []

    rows, cols = _get_sampling_grid(sample_points)
    patch_radius = max(2, int(min(roi.shape[0], roi.shape[1]) * 0.04))

    cell_w = roi.shape[1] / cols
    cell_h = roi.shape[0] / rows
    jitter_w = cell_w * 0.3
    jitter_h = cell_h * 0.3

    samples: list[tuple[float, float, float]] = []
    for row in range(rows):
        for col in range(cols):
            base_px = (col + 0.5) * cell_w
            base_py = (row + 0.5) * cell_h
            px = int(base_px + random.uniform(-jitter_w, jitter_w))
            py = int(base_py + random.uniform(-jitter_h, jitter_h))
            px = max(0, min(roi.shape[1] - 1, px))
            py = max(0, min(roi.shape[0] - 1, py))

            if pixel_puro:
                b, g, r = roi[py, px]
            else:
                sx0 = max(0, px - patch_radius)
                sx1 = min(roi.shape[1], px + patch_radius)
                sy0 = max(0, py - patch_radius)
                sy1 = min(roi.shape[0], py + patch_radius)

                patch = roi[sy0:sy1, sx0:sx1]
                if patch.size == 0:
                    continue

                b, g, r = patch.mean(axis=(0, 1))
            samples.append((float(r), float(g), float(b)))

    return samples


@router.post(
    "/capture-robust-sample",
    response_model=RobustSampleResponse,
    tags=["Calibração"],
    summary="Captura amostras robustas com remoção de outliers e estimativa de estabilidade",
)
def capture_robust_sample(
    sample_count: int = Query(default=5, ge=1, le=20, description="Quantidade de frames a capturar"),
    interval_ms: int = Query(default=200, ge=50, le=5000, description="Intervalo entre frames em ms"),
    area_width_percent: float = Query(default=60.0, gt=0, le=100.0, description="Largura percentual da ROI"),
    area_height_percent: float = Query(default=50.0, gt=0, le=100.0, description="Altura percentual da ROI"),
    sample_points: int = Query(default=9, description="Quantidade de pontos (4, 9 ou 18)"),
    include_samples: bool = Query(default=False, description="Incluir pontos brutos na resposta"),
    pixel_puro: bool = Query(default=False, description="Usar amostragem de pixel puro sem filtro"),
) -> JSONResponse:
    if sample_count < 1 or sample_count > 20:
        raise HTTPException(status_code=400, detail="sample_count deve estar entre 1 e 20")
    if interval_ms < 50 or interval_ms > 5000:
        raise HTTPException(status_code=400, detail="interval_ms deve estar entre 50 e 5000ms")
    if area_width_percent <= 0 or area_width_percent > 100:
        raise HTTPException(status_code=400, detail="area_width_percent deve estar entre 0 e 100")
    if area_height_percent <= 0 or area_height_percent > 100:
        raise HTTPException(status_code=400, detail="area_height_percent deve estar entre 0 e 100")
    if sample_points not in (4, 9, 18):
        raise HTTPException(status_code=400, detail="sample_points deve ser 4, 9 ou 18")

    samples = []
    luminance_values = []
    successful_captures = 0
    raw_point_samples: list[tuple[float, float, float]] = []

    for i in range(sample_count):
        try:
            frame = rt.decode_latest_frame()
            frame_samples = _collect_area_samples(
                frame=frame,
                area_width_percent=area_width_percent,
                area_height_percent=area_height_percent,
                sample_points=sample_points,
                pixel_puro=pixel_puro,
            )
            if frame_samples:
                raw_point_samples.extend(frame_samples)
                frame_mean = _calculate_robust_mean(frame_samples)
                samples.append(frame_mean)
                luminance_values.append(_calculate_luminance(frame_mean))
                successful_captures += 1
        except Exception:
            _log.exception("Error capturing sample %s", i + 1)

        if i < sample_count - 1:
            time.sleep(interval_ms / 1000.0)

    if not samples:
        raise HTTPException(status_code=503, detail="Nenhuma amostra capturada com sucesso")

    clean_samples = _remove_color_outliers(samples)
    robust_mean = _calculate_robust_mean(clean_samples)
    average_luminance = np.mean(luminance_values) if luminance_values else 0
    mean_distance = np.mean([_calculate_color_distance(s, robust_mean) for s in clean_samples])

    rgb_result = {
        "r": int(round(robust_mean[0])),
        "g": int(round(robust_mean[1])),
        "b": int(round(robust_mean[2])),
    }
    hex_value = f"#{rgb_result['r']:02x}{rgb_result['g']:02x}{rgb_result['b']:02x}"

    result = {
        "success": True,
        "rgb": rgb_result,
        "hex": hex_value,
        "samples_captured": successful_captures,
        "samples_total": sample_count,
        "samples_used": len(clean_samples),
        "average_luminance": float(average_luminance) / 255.0,
        "stability_score": max(0.0, 1.0 - float(mean_distance) / 50.0),
        "sampling_config": {
            "area_width_percent": area_width_percent,
            "area_height_percent": area_height_percent,
            "sample_points": sample_points,
        },
    }

    if include_samples:
        result["samples"] = [
            {"r": int(round(r)), "g": int(round(g)), "b": int(round(b))}
            for (r, g, b) in raw_point_samples
        ]

    return JSONResponse(result)


@router.get(
    "/pattern-status",
    response_model=PatternStatusResponse,
    tags=["Anomalib"],
    summary="Retorna status e metadados da calibração ativa de estampa",
)
def get_pattern_status() -> JSONResponse:
    det = rt.get_or_load_anomalib_detector()
    return JSONResponse(det.get_status())


@router.post(
    "/clear-pattern",
    response_model=ClearPatternResponse,
    tags=["Anomalib"],
    summary="Limpa a calibração de estampa ativa em memória e disco",
)
def clear_pattern() -> JSONResponse:
    det = rt.get_or_load_anomalib_detector()
    det.clear_pattern()
    return JSONResponse({"success": True, "calibrated": False})


@router.post(
    "/calibrate-pattern",
    response_model=CalibratePatternResponse,
    tags=["Anomalib"],
    summary="Captura frames de tecido bom ao vivo e calibra a estampa no Anomalib",
)
def calibrate_pattern(payload: CalibratePatternPayload = Body(default=CalibratePatternPayload())) -> JSONResponse:
    w_pct = max(5, min(100, int(payload.w)))
    h_pct = max(5, min(100, int(payload.h)))
    num_frames = max(3, min(40, int(payload.num_frames)))
    interval_ms = max(40, min(2000, int(payload.interval_ms)))

    captured_rois: list[np.ndarray] = []
    for i in range(num_frames):
        frame = rt.decode_latest_frame()
        h_frame, w_frame = frame.shape[:2]
        largura = max(2, int(w_frame * (w_pct / 100.0)))
        altura = max(2, int(h_frame * (h_pct / 100.0)))
        x_inicio = max(0, int(w_frame / 2 - largura / 2))
        y_inicio = max(0, int(h_frame / 2 - altura / 2))
        x_fim = min(w_frame, x_inicio + largura)
        y_fim = min(h_frame, y_inicio + altura)

        roi = frame[y_inicio:y_fim, x_inicio:x_fim]
        if roi.size > 0:
            captured_rois.append(roi.copy())

        if i < num_frames - 1:
            time.sleep(interval_ms / 1000.0)

    if not captured_rois:
        raise HTTPException(status_code=503, detail="Não foi possível capturar frames válidos da câmera.")

    det = rt.get_or_load_anomalib_detector()
    metadata = det.fit_from_frames(captured_rois)

    set_runtime_setting("anomalib_active_pattern", metadata)

    return JSONResponse(
        {
            "success": True,
            "status": "calibrated",
            "metadata": metadata,
        }
    )
