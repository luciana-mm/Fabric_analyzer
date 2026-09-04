import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional, List, Tuple, Dict, Any

@dataclass
class Detection:
    box: Tuple[int, int, int, int]  # (x0, y0, x1, y1)
    centroid: Tuple[int, int]
    area: float

class DefectTracker:
    """Rastreia falhas entre frames e conta quantas cruzaram a linha de referência."""
    def __init__(self, linha_orientacao: str = "vertical", frames_max_sumico: int = 15, frames_min_confirmacao: int = 4, distancia_max_rastreio: int = 90):
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
                self.next_id += 1
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

        return ativos

    def reset(self):
        self.next_id = 0
        self.objetos = {}
        self.total_count = 0


class BaseDetector:
    def detect(self, roi: np.ndarray, config: dict) -> List[Detection]:
        raise NotImplementedError()


class ColorDetector(BaseDetector):
    def __init__(self):
        self.distancia_max_fusao = 40
        self.area_min_pequena = 10
        self.area_max_pequena = 3000
        self.area_min_mancha = 3000
        self.area_max_mancha = 200000
        self.solidez_minima = 0.55
        self.proporcao_maxima = 3.2
        self.limiar_cor_ab = 9
        self.kernel_local_estampado = 51
        self.limiar_cor_local_estampado = 12
        self.area_maxima_relativa_roi = 0.35

    def _fundir_centroides_proximos(self, centroides: List[Tuple[int, int]], boxes: List[Tuple[int, int, int, int]]) -> Tuple[List[Tuple[int, int]], List[Tuple[int, int, int, int]]]:
        if len(centroides) <= 1:
            return centroides, boxes

        usados = [False] * len(centroides)
        novos_centroides = []
        novos_boxes = []

        for i in range(len(centroides)):
            if usados[i]:
                continue
            grupo_idx = [i]
            usados[i] = True

            mudou = True
            while mudou:
                mudou = False
                for j in range(len(centroides)):
                    if usados[j]:
                        continue
                    for k in grupo_idx:
                        dist = np.hypot(centroides[j][0] - centroides[k][0], centroides[j][1] - centroides[k][1])
                        if dist < self.distancia_max_fusao:
                            grupo_idx.append(j)
                            usados[j] = True
                            mudou = True
                            break

            gx = int(np.mean([centroides[g][0] for g in grupo_idx]))
            gy = int(np.mean([centroides[g][1] for g in grupo_idx]))
            novos_centroides.append((gx, gy))

            x0 = min(boxes[g][0] for g in grupo_idx)
            y0 = min(boxes[g][1] for g in grupo_idx)
            x1 = max(boxes[g][2] for g in grupo_idx)
            y1 = max(boxes[g][3] for g in grupo_idx)
            novos_boxes.append((x0, y0, x1, y1))

        return novos_centroides, novos_boxes

    def _mask_intensidade(self, gray_roi: np.ndarray) -> np.ndarray:
        fundo = cv2.medianBlur(gray_roi, 41)
        diff = cv2.absdiff(gray_roi, fundo)
        diff = cv2.GaussianBlur(diff, (3, 3), 0)
        _, mask = cv2.threshold(diff, 16, 255, cv2.THRESH_BINARY)
        return mask

    def _mask_cor(self, roi_bgr: np.ndarray, paleta: Optional[List[Tuple[int, int]]] = None, ref_a: Optional[int] = None, ref_b: Optional[int] = None) -> np.ndarray:
        lab = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2LAB)
        _, a_ch, b_ch = cv2.split(lab)

        if paleta:
            a_i = a_ch.astype(np.int16)
            b_i = b_ch.astype(np.int16)
            dist_min = None
            for pa, pb in paleta:
                diff_a = np.abs(a_i - int(pa)).astype(np.float32)
                diff_b = np.abs(b_i - int(pb)).astype(np.float32)
                dist = diff_a * 0.5 + diff_b * 0.5
                dist_min = dist if dist_min is None else np.minimum(dist_min, dist)
            diff_cor = np.clip(dist_min, 0, 255).astype(np.uint8)
            diff_cor = cv2.GaussianBlur(diff_cor, (5, 5), 0)
            _, mask = cv2.threshold(diff_cor, self.limiar_cor_ab, 255, cv2.THRESH_BINARY)
            return mask

        if ref_a is None or ref_b is None:
            ref_a = int(round(float(np.median(a_ch))))
            ref_b = int(round(float(np.median(b_ch))))
        else:
            ref_a = int(np.clip(ref_a, 0, 255))
            ref_b = int(np.clip(ref_b, 0, 255))

        diff_a = cv2.absdiff(a_ch, np.full_like(a_ch, ref_a))
        diff_b = cv2.absdiff(b_ch, np.full_like(b_ch, ref_b))
        diff_cor = cv2.addWeighted(diff_a, 0.5, diff_b, 0.5, 0)
        diff_cor = cv2.GaussianBlur(diff_cor, (5, 5), 0)
        _, mask = cv2.threshold(diff_cor, self.limiar_cor_ab, 255, cv2.THRESH_BINARY)
        return mask

    def _mask_cor_local(self, roi_bgr: np.ndarray) -> np.ndarray:
        tamanho_kernel = max(3, int(self.kernel_local_estampado))
        if tamanho_kernel % 2 == 0:
            tamanho_kernel += 1
        lab = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2LAB)
        _, a_ch, b_ch = cv2.split(lab)
        fundo_a = cv2.medianBlur(a_ch, tamanho_kernel)
        fundo_b = cv2.medianBlur(b_ch, tamanho_kernel)
        diff_a = cv2.absdiff(a_ch, fundo_a)
        diff_b = cv2.absdiff(b_ch, fundo_b)
        diff_cor = cv2.addWeighted(diff_a, 0.5, diff_b, 0.5, 0)
        diff_cor = cv2.GaussianBlur(diff_cor, (5, 5), 0)
        _, mask = cv2.threshold(diff_cor, self.limiar_cor_local_estampado, 255, cv2.THRESH_BINARY)
        return mask

    def _preencher_buracos(self, mask: np.ndarray) -> np.ndarray:
        h, w = mask.shape[:2]
        mask_ff = mask.copy()
        flood_mask = np.zeros((h + 2, w + 2), np.uint8)
        cv2.floodFill(mask_ff, flood_mask, (0, 0), 255)
        mask_ff_inv = cv2.bitwise_not(mask_ff)
        return cv2.bitwise_or(mask, mask_ff_inv)

    def _contorno_parece_defeito(self, cont, area_roi_total: Optional[int] = None) -> bool:
        area = cv2.contourArea(cont)
        if area <= 0:
            return False
        if area_roi_total is not None and area > area_roi_total * self.area_maxima_relativa_roi:
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

        if area >= self.area_min_mancha:
            return solidez >= (self.solidez_minima - 0.15) and proporcao <= (self.proporcao_maxima + 1.0)
        return solidez >= self.solidez_minima and proporcao <= self.proporcao_maxima

    def detect(self, roi: np.ndarray, config: dict) -> List[Detection]:
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        mask_intensidade = self._mask_intensidade(gray_roi)
        
        estampado = config.get("estampado", False)
        paleta = config.get("paleta")
        ref_a = config.get("ref_a")
        ref_b = config.get("ref_b")
        
        mask_cor = self._mask_cor_local(roi) if estampado else self._mask_cor(roi, paleta=paleta, ref_a=ref_a, ref_b=ref_b)
        mask = cv2.bitwise_or(mask_intensidade, mask_cor)

        kernel_morf = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_morf, iterations=1)
        kernel_fusao = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.dilate(mask, kernel_fusao, iterations=1)
        mask = self._preencher_buracos(mask)

        contornos, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        roi_h, roi_w = roi.shape[:2]
        centroides = []
        boxes = []

        for cont in contornos:
            area = cv2.contourArea(cont)
            if not ((self.area_min_pequena < area < self.area_max_pequena) or (self.area_min_mancha <= area < self.area_max_mancha)):
                continue

            if not self._contorno_parece_defeito(cont, area_roi_total=roi_h * roi_w):
                continue

            x, y, w, h = cv2.boundingRect(cont)
            cx = x + w // 2
            cy = y + h // 2
            centroides.append((cx, cy))
            boxes.append((x, y, x + w, y + h))

        centroides, boxes = self._fundir_centroides_proximos(centroides, boxes)
        
        detections = []
        for (cx, cy), (bx0, by0, bx1, by1) in zip(centroides, boxes):
            w = bx1 - bx0
            h = by1 - by0
            detections.append(Detection(box=(bx0, by0, bx1, by1), centroid=(cx, cy), area=float(w*h)))
            
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
    def draw_results(frame: np.ndarray, config: dict, ativos: List[Tuple[int, int, int]], abs_detections: List[Detection], x_inicio: int, y_inicio: int, x_fim: int, y_fim: int) -> np.ndarray:
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
            for (aid, ax, ay) in ativos:
                if ax == abs_cx and ay == abs_cy:
                    obj_id = str(aid)
                    break
                    
            cv2.rectangle(result, (abs_bx0, abs_by0), (abs_bx1, abs_by1), (0, 255, 0), 3)
            cv2.putText(result, f"#{obj_id}", (abs_bx0, max(0, abs_by0 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        return result


def to_grayscale(frame: np.ndarray) -> np.ndarray:
    """Converte o frame original apenas para tons de cinza"""
    return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
