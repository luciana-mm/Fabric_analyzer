from abc import ABC, abstractmethod
from dataclasses import dataclass
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

DEFECT_CLASSES = ["furo", "mancha", "fio_puxado", "tonalidade"]


@dataclass
class Detection:
    box: Tuple[int, int, int, int]  # (x0, y0, x1, y1)
    centroid: Tuple[int, int]
    area: float
    label: Optional[str] = None
    confidence: Optional[float] = None


class DefectTracker:
    """Rastreia falhas entre frames e conta quantas cruzaram a linha de referência (Thread-Safe)."""

    def __init__(
        self,
        linha_orientacao: str = "vertical",
        frames_max_sumico: int = 15,
        frames_min_confirmacao: int = 4,
        distancia_max_rastreio: int = 90,
    ):
        self._lock = threading.Lock()
        self.next_id = 0
        self.objetos: Dict[int, Dict[str, Any]] = {}
        self.total_count = 0
        self.linha_orientacao = linha_orientacao
        self.frames_max_sumico = frames_max_sumico
        self.frames_min_confirmacao = frames_min_confirmacao
        self.distancia_max_rastreio = distancia_max_rastreio

    def _lado_da_linha(self, cx: int, cy: int, linha_pos: int) -> str:
        if self.linha_orientacao == "horizontal":
            return "cima" if cy < linha_pos else "baixo"
        else:
            return "esquerda" if cx < linha_pos else "direita"

    def update(self, deteccoes: List[Detection], linha_pos: int) -> List[Tuple[int, int, int]]:
        with self._lock:
            ids_usados = set()
            ativos = []

            for det in deteccoes:
                cx, cy = det.centroid
                melhor_id = None
                melhor_dist = self.distancia_max_rastreio

                for obj_id, dados in self.objetos.items():
                    if obj_id in ids_usados:
                        continue
                    ox, oy = dados["centroide"]
                    dist = np.hypot(cx - ox, cy - oy)
                    if dist < melhor_dist:
                        melhor_dist = dist
                        melhor_id = obj_id

                if melhor_id is not None:
                    obj_id = melhor_id
                else:
                    obj_id = self.next_id
                    self.next_id = (self.next_id + 1) % 1_000_000
                    self.objetos[obj_id] = {
                        "centroide": (cx, cy),
                        "sumico": 0,
                        "lado": None,
                        "contado": False,
                        "frames_vivo": 0,
                    }

                ids_usados.add(obj_id)
                dados = self.objetos[obj_id]
                dados["centroide"] = (cx, cy)
                dados["sumico"] = 0
                dados["frames_vivo"] += 1

                lado_atual = self._lado_da_linha(cx, cy, linha_pos)
                if dados["lado"] is None:
                    dados["lado"] = lado_atual
                elif lado_atual != dados["lado"] and not dados["contado"]:
                    if dados["frames_vivo"] >= self.frames_min_confirmacao:
                        self.total_count += 1
                        dados["contado"] = True
                    dados["lado"] = lado_atual
                else:
                    dados["lado"] = lado_atual

                ativos.append((obj_id, cx, cy))

            for obj_id in list(self.objetos.keys()):
                if obj_id not in ids_usados:
                    self.objetos[obj_id]["sumico"] += 1
                    if self.objetos[obj_id]["sumico"] > self.frames_max_sumico:
                        del self.objetos[obj_id]

            if not self.objetos:
                self.next_id = 0

            return ativos

    def get_count(self) -> int:
        with self._lock:
            return self.total_count

    def reset(self) -> None:
        with self._lock:
            self.next_id = 0
            self.objetos.clear()
            self.total_count = 0


class BaseDetector(ABC):
    """
    Interface Strategy para motores de detecção de defeitos têxteis (ADR Seção 5):
    - `ColorDetector` (mode_name='classic'): Tecidos lisos em CIE L*a*b* + Morfologia.
    - `AnomalibDetector` (mode_name='anomalib'): Tecidos estampados/detalhados via PatchCore.
    """

    mode_name: str = "base"
    last_inference_ms: float = 0.0

    @abstractmethod
    def detect(self, roi: np.ndarray, config: dict) -> List[Detection]:
        raise NotImplementedError()

    def get_status(self) -> Dict[str, Any]:
        return {
            "mode": self.mode_name,
            "calibrated": True,
            "last_inference_ms": self.last_inference_ms,
        }


class ColorDetector(BaseDetector):
    """
    Estratégia determinística de Visão Computacional Clássica (OpenCV) para tecidos lisos.
    Opera com normalização de iluminação local e distância perceptual euclidiana CIE L*a*b*.
    """

    mode_name = "classic"

    def __init__(
        self,
        distancia_max_fusao: int = 40,
        area_min_pequena: int = 10,
        area_max_pequena: int = 3000,
        area_min_mancha: int = 3000,
        area_max_mancha: int = 200000,
        solidez_minima: float = 0.55,
        proporcao_maxima: float = 3.2,
        limiar_cor_ab: float = 9.0,
        kernel_local_estampado: int = 51,
        limiar_cor_local_estampado: float = 12.0,
        area_maxima_relativa_roi: float = 0.35,
    ):
        self.distancia_max_fusao = distancia_max_fusao
        self.area_min_pequena = area_min_pequena
        self.area_max_pequena = area_max_pequena
        self.area_min_mancha = area_min_mancha
        self.area_max_mancha = area_max_mancha
        self.solidez_minima = solidez_minima
        self.proporcao_maxima = proporcao_maxima
        self.limiar_cor_ab = limiar_cor_ab
        self.kernel_local_estampado = kernel_local_estampado
        self.limiar_cor_local_estampado = limiar_cor_local_estampado
        self.area_maxima_relativa_roi = area_maxima_relativa_roi
        # Kernel morfológico pré-alocado para evitar recriação a cada frame
        self._kernel_ellipse_3x3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))

    def _fundir_deteccoes_proximas(
        self,
        items: List[Tuple[Tuple[int, int], Tuple[int, int, int, int], float, str, float]],
        distancia_max_fusao: Optional[int] = None,
    ) -> List[Detection]:
        if distancia_max_fusao is None:
            distancia_max_fusao = self.distancia_max_fusao

        if not items:
            return []
        if len(items) == 1:
            (cx, cy), box, area, label, conf = items[0]
            return [Detection(box=box, centroid=(cx, cy), area=area, label=label, confidence=round(conf, 3))]

        usados = [False] * len(items)
        fused: List[Detection] = []

        for i in range(len(items)):
            if usados[i]:
                continue
            grupo_idx = [i]
            usados[i] = True

            mudou = True
            while mudou:
                mudou = False
                for j in range(len(items)):
                    if usados[j]:
                        continue
                    for k in grupo_idx:
                        dist = np.hypot(items[j][0][0] - items[k][0][0], items[j][0][1] - items[k][0][1])
                        if dist < distancia_max_fusao:
                            grupo_idx.append(j)
                            usados[j] = True
                            mudou = True
                            break

            gx = int(np.mean([items[g][0][0] for g in grupo_idx]))
            gy = int(np.mean([items[g][0][1] for g in grupo_idx]))

            x0 = min(items[g][1][0] for g in grupo_idx)
            y0 = min(items[g][1][1] for g in grupo_idx)
            x1 = max(items[g][1][2] for g in grupo_idx)
            y1 = max(items[g][1][3] for g in grupo_idx)

            total_area = float(sum(items[g][2] for g in grupo_idx))
            # Escolhe o rótulo do componente de maior área no grupo fundido
            dominant_idx = max(grupo_idx, key=lambda idx: items[idx][2])
            label = items[dominant_idx][3]
            max_conf = float(max(items[g][4] for g in grupo_idx))

            fused.append(
                Detection(
                    box=(x0, y0, x1, y1),
                    centroid=(gx, gy),
                    area=total_area,
                    label=label,
                    confidence=round(max_conf, 3),
                )
            )

        return fused

    def _mask_intensidade(self, gray_roi: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        fundo = cv2.medianBlur(gray_roi, 41)
        diff = cv2.absdiff(gray_roi, fundo)
        diff = cv2.GaussianBlur(diff, (3, 3), 0)
        _, mask = cv2.threshold(diff, 16, 255, cv2.THRESH_BINARY)
        return mask, diff

    @staticmethod
    def _delta_e_ab_norm(diff_a: np.ndarray, diff_b: np.ndarray) -> np.ndarray:
        """
        Calcula a distância euclidiana cromática no plano CIE a*b* (ADR Seção 1.1):
        DeltaE_ab = sqrt((a - a_ref)^2 + (b - b_ref)^2) normalizada por 1/sqrt(2)
        para preservar a escala do limiar_cor_ab calibrado.
        """
        mag = cv2.magnitude(diff_a.astype(np.float32), diff_b.astype(np.float32)) * 0.70710678
        return np.clip(mag, 0, 255).astype(np.uint8)

    def _mask_cor(
        self,
        roi_bgr: np.ndarray,
        paleta: Optional[List[Tuple[int, int]]] = None,
        ref_a: Optional[int] = None,
        ref_b: Optional[int] = None,
        limiar_cor_ab: Optional[float] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        if limiar_cor_ab is None:
            limiar_cor_ab = self.limiar_cor_ab

        lab = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2LAB)
        _, a_ch, b_ch = cv2.split(lab)

        if paleta:
            dist_min: Optional[np.ndarray] = None
            for pa, pb in paleta:
                diff_a = cv2.absdiff(a_ch, int(np.clip(pa, 0, 255)))
                diff_b = cv2.absdiff(b_ch, int(np.clip(pb, 0, 255)))
                dist = self._delta_e_ab_norm(diff_a, diff_b)
                dist_min = dist if dist_min is None else cv2.min(dist_min, dist)
            diff_cor = dist_min if dist_min is not None else np.zeros_like(a_ch)
            diff_cor = cv2.GaussianBlur(diff_cor, (5, 5), 0)
            _, mask = cv2.threshold(diff_cor, limiar_cor_ab, 255, cv2.THRESH_BINARY)
            return mask, diff_cor

        if ref_a is None or ref_b is None:
            ref_a = int(round(float(np.median(a_ch))))
            ref_b = int(round(float(np.median(b_ch))))
        else:
            ref_a = int(np.clip(ref_a, 0, 255))
            ref_b = int(np.clip(ref_b, 0, 255))

        # Usa escalar direto no cv2.absdiff em C++ sem alocar matrizes np.full_like intermediárias
        diff_a = cv2.absdiff(a_ch, ref_a)
        diff_b = cv2.absdiff(b_ch, ref_b)
        diff_cor = self._delta_e_ab_norm(diff_a, diff_b)
        diff_cor = cv2.GaussianBlur(diff_cor, (5, 5), 0)
        _, mask = cv2.threshold(diff_cor, limiar_cor_ab, 255, cv2.THRESH_BINARY)
        return mask, diff_cor

    def _mask_cor_local(
        self,
        roi_bgr: np.ndarray,
        kernel_local_estampado: Optional[int] = None,
        limiar_cor_local_estampado: Optional[float] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        if kernel_local_estampado is None:
            kernel_local_estampado = self.kernel_local_estampado
        if limiar_cor_local_estampado is None:
            limiar_cor_local_estampado = self.limiar_cor_local_estampado

        tamanho_kernel = max(3, int(kernel_local_estampado))
        if tamanho_kernel % 2 == 0:
            tamanho_kernel += 1
        lab = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2LAB)
        _, a_ch, b_ch = cv2.split(lab)
        fundo_a = cv2.medianBlur(a_ch, tamanho_kernel)
        fundo_b = cv2.medianBlur(b_ch, tamanho_kernel)
        diff_a = cv2.absdiff(a_ch, fundo_a)
        diff_b = cv2.absdiff(b_ch, fundo_b)
        diff_cor = self._delta_e_ab_norm(diff_a, diff_b)
        diff_cor = cv2.GaussianBlur(diff_cor, (5, 5), 0)
        _, mask = cv2.threshold(diff_cor, limiar_cor_local_estampado, 255, cv2.THRESH_BINARY)
        return mask, diff_cor

    def _preencher_buracos(self, mask: np.ndarray) -> np.ndarray:
        h, w = mask.shape[:2]
        mask_ff = mask.copy()
        flood_mask = np.zeros((h + 2, w + 2), np.uint8)
        cv2.floodFill(mask_ff, flood_mask, (0, 0), 255)
        cv2.bitwise_not(mask_ff, mask_ff)
        return cv2.bitwise_or(mask, mask_ff)

    def _contorno_parece_defeito(
        self,
        cont,
        area_roi_total: Optional[int] = None,
        area_min_mancha: Optional[int] = None,
        solidez_minima: Optional[float] = None,
        proporcao_maxima: Optional[float] = None,
        area_maxima_relativa_roi: Optional[float] = None,
    ) -> bool:
        if area_min_mancha is None:
            area_min_mancha = self.area_min_mancha
        if solidez_minima is None:
            solidez_minima = self.solidez_minima
        if proporcao_maxima is None:
            proporcao_maxima = self.proporcao_maxima
        if area_maxima_relativa_roi is None:
            area_maxima_relativa_roi = self.area_maxima_relativa_roi

        area = cv2.contourArea(cont)
        if area <= 0:
            return False
        if area_roi_total is not None and area > area_roi_total * area_maxima_relativa_roi:
            return False

        hull = cv2.convexHull(cont)
        hull_area = cv2.contourArea(hull)
        if hull_area <= 0:
            return False

        solidez = area / hull_area
        x, y, w, h = cv2.boundingRect(cont)
        lado_maior = max(w, h)
        lado_menor = max(1, min(w, h))
        proporcao = lado_maior / lado_menor

        if area >= area_min_mancha:
            return solidez >= (solidez_minima - 0.15) and proporcao <= (proporcao_maxima + 1.0)
        return solidez >= solidez_minima and proporcao <= proporcao_maxima

    @staticmethod
    def _classificar_defeito(
        area: float,
        w: int,
        h: int,
        area_min_mancha: float,
        int_peak: float,
        cor_peak: float,
        limiar_cor: float,
    ) -> Tuple[str, float]:
        proporcao = max(w, h) / max(1, min(w, h))
        if area >= area_min_mancha:
            label = "tonalidade" if cor_peak > int_peak * 1.15 else "mancha"
        elif proporcao >= 2.2:
            label = "fio_puxado"
        elif cor_peak >= limiar_cor * 1.35 and cor_peak > int_peak:
            label = "mancha"
        else:
            label = "furo"

        ratio = max(int_peak / 16.0, cor_peak / max(limiar_cor, 1.0))
        confidence = min(0.99, max(0.65, 0.55 + (ratio - 1.0) * 0.25))
        return label, confidence

    def detect(self, roi: np.ndarray, config: dict) -> List[Detection]:
        t0 = time.perf_counter()
        if roi is None or roi.size == 0 or roi.ndim < 2 or roi.shape[0] < 4 or roi.shape[1] < 4:
            self.last_inference_ms = 0.0
            return []

        distancia_max_fusao = config.get("distancia_max_fusao", self.distancia_max_fusao)
        area_min_pequena = config.get("area_min_pequena", self.area_min_pequena)
        area_max_pequena = config.get("area_max_pequena", self.area_max_pequena)
        area_min_mancha = config.get("area_min_mancha", self.area_min_mancha)
        area_max_mancha = config.get("area_max_mancha", self.area_max_mancha)
        solidez_minima = config.get("solidez_minima", self.solidez_minima)
        proporcao_maxima = config.get("proporcao_maxima", self.proporcao_maxima)
        limiar_cor_ab = config.get("limiar_cor_ab", self.limiar_cor_ab)
        kernel_local_estampado = config.get("kernel_local_estampado", self.kernel_local_estampado)
        limiar_cor_local_estampado = config.get("limiar_cor_local_estampado", self.limiar_cor_local_estampado)
        area_maxima_relativa_roi = config.get("area_maxima_relativa_roi", self.area_maxima_relativa_roi)

        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if roi.ndim == 3 else roi
        mask_intensidade, diff_int = self._mask_intensidade(gray_roi)

        estampado = config.get("estampado", False)
        paleta = config.get("paleta")
        ref_a = config.get("ref_a")
        ref_b = config.get("ref_b")

        if roi.ndim == 3:
            mask_cor, diff_cor = (
                self._mask_cor_local(
                    roi,
                    kernel_local_estampado=kernel_local_estampado,
                    limiar_cor_local_estampado=limiar_cor_local_estampado,
                )
                if estampado
                else self._mask_cor(
                    roi,
                    paleta=paleta,
                    ref_a=ref_a,
                    ref_b=ref_b,
                    limiar_cor_ab=limiar_cor_ab,
                )
            )
            mask = cv2.bitwise_or(mask_intensidade, mask_cor)
        else:
            diff_cor = np.zeros_like(gray_roi)
            mask = mask_intensidade

        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self._kernel_ellipse_3x3, iterations=1)
        mask = cv2.dilate(mask, self._kernel_ellipse_3x3, iterations=1)
        mask = self._preencher_buracos(mask)

        contornos, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        roi_h, roi_w = roi.shape[:2]
        raw_items: List[Tuple[Tuple[int, int], Tuple[int, int, int, int], float, str, float]] = []
        limiar_cor_efetivo = float(limiar_cor_local_estampado if estampado else limiar_cor_ab)

        for cont in contornos:
            area = float(cv2.contourArea(cont))
            if not ((area_min_pequena < area < area_max_pequena) or (area_min_mancha <= area < area_max_mancha)):
                continue

            if not self._contorno_parece_defeito(
                cont,
                area_roi_total=roi_h * roi_w,
                area_min_mancha=area_min_mancha,
                solidez_minima=solidez_minima,
                proporcao_maxima=proporcao_maxima,
                area_maxima_relativa_roi=area_maxima_relativa_roi,
            ):
                continue

            x, y, w, h = cv2.boundingRect(cont)
            cx = x + w // 2
            cy = y + h // 2

            int_patch = diff_int[y : y + h, x : x + w]
            cor_patch = diff_cor[y : y + h, x : x + w]
            int_peak = float(np.max(int_patch)) if int_patch.size > 0 else 16.0
            cor_peak = float(np.max(cor_patch)) if cor_patch.size > 0 else 0.0

            label, conf = self._classificar_defeito(
                area=area,
                w=w,
                h=h,
                area_min_mancha=area_min_mancha,
                int_peak=int_peak,
                cor_peak=cor_peak,
                limiar_cor=limiar_cor_efetivo,
            )
            raw_items.append(((cx, cy), (x, y, x + w, y + h), area, label, conf))

        detections = self._fundir_deteccoes_proximas(raw_items, distancia_max_fusao=distancia_max_fusao)
        self.last_inference_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return detections


class Visualizer:
    @staticmethod
    def draw_dashed_rectangle(img, pt1, pt2, color, thickness=2, dash_length=10, gap_length=6):
        x1, y1 = pt1
        x2, y2 = pt2

        def draw_dashed_line(p1, p2):
            lx1, ly1 = p1
            lx2, ly2 = p2
            dist = int(np.hypot(lx2 - lx1, ly2 - ly1))
            if dist == 0:
                return
            dx = (lx2 - lx1) / dist
            dy = (ly2 - ly1) / dist

            pos = 0
            draw = True
            while pos < dist:
                seg_len = dash_length if draw else gap_length
                end_pos = min(pos + seg_len, dist)
                if draw:
                    start = (int(lx1 + dx * pos), int(ly1 + dy * pos))
                    end = (int(lx1 + dx * end_pos), int(ly1 + dy * end_pos))
                    cv2.line(img, start, end, color, thickness)
                pos = end_pos
                draw = not draw

        draw_dashed_line((x1, y1), (x2, y1))
        draw_dashed_line((x2, y1), (x2, y2))
        draw_dashed_line((x2, y2), (x1, y2))
        draw_dashed_line((x1, y2), (x1, y1))

    @staticmethod
    def draw_results(
        frame: np.ndarray,
        config: dict,
        ativos: List[Tuple[int, int, int]],
        abs_detections: List[Detection],
        x_inicio: int,
        y_inicio: int,
        x_fim: int,
        y_fim: int,
    ) -> np.ndarray:
        result = frame.copy()

        Visualizer.draw_dashed_rectangle(
            result,
            (x_inicio, y_inicio),
            (x_fim, y_fim),
            color=(255, 255, 255),
            thickness=2,
            dash_length=12,
            gap_length=8,
        )

        linha_orientacao = config.get("linha_orientacao", "vertical")
        linha_posicao_percent = config.get("linha_posicao_percent", 50)

        largura = x_fim - x_inicio
        altura = y_fim - y_inicio

        if linha_orientacao == "horizontal":
            linha_pos_abs = y_inicio + int(altura * (linha_posicao_percent / 100.0))
            cv2.line(result, (x_inicio, linha_pos_abs), (x_fim, linha_pos_abs), (0, 165, 255), 2)
        else:
            linha_pos_abs = x_inicio + int(largura * (linha_posicao_percent / 100.0))
            cv2.line(result, (linha_pos_abs, y_inicio), (linha_pos_abs, y_fim), (0, 165, 255), 2)

        if config.get("apenas_area", False):
            return result

        for det in abs_detections:
            abs_bx0, abs_by0, abs_bx1, abs_by1 = det.box
            abs_cx, abs_cy = det.centroid

            obj_id = "?"
            for aid, ax, ay in ativos:
                if ax == abs_cx and ay == abs_cy:
                    obj_id = str(aid)
                    break

            cv2.rectangle(result, (abs_bx0, abs_by0), (abs_bx1, abs_by1), (0, 255, 0), 3)
            label_text = f"#{obj_id}"
            if det.label:
                label_text += f" {det.label}"
            if det.confidence is not None:
                label_text += f" ({det.confidence:.2f})"
            cv2.putText(
                result,
                label_text,
                (abs_bx0, max(0, abs_by0 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                1,
            )

        return result


def to_grayscale(frame: np.ndarray) -> np.ndarray:
    """Converte o frame original apenas para tons de cinza"""
    return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
