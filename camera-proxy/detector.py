import cv2
import numpy as np

# ============================================================
# CONFIGURAÇÃO DA LINHA DE CONTAGEM (esteira em movimento)
# ============================================================
LINHA_ORIENTACAO = "vertical"
LINHA_POSICAO_PERCENT = 50
DISTANCIA_MAX_RASTREIO = 90
FRAMES_MAX_SUMICO = 15
FRAMES_MIN_CONFIRMACAO = 4


class DefectTracker:
    """Rastreia falhas entre frames e conta quantas cruzaram a linha de referência."""

    def __init__(self):
        self.next_id = 0
        self.objetos = {}
        self.total_count = 0

    def _lado_da_linha(self, cx, cy, linha_pos):
        if LINHA_ORIENTACAO == "horizontal":
            return "cima" if cy < linha_pos else "baixo"
        else:
            return "esquerda" if cx < linha_pos else "direita"

    def update(self, centroides, linha_pos):
        ids_usados = set()
        ativos = []

        for cx, cy in centroides:
            melhor_id = None
            melhor_dist = DISTANCIA_MAX_RASTREIO

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
                if dados["frames_vivo"] >= FRAMES_MIN_CONFIRMACAO:
                    self.total_count += 1
                    dados["contado"] = True
                dados["lado"] = lado_atual
            else:
                dados["lado"] = lado_atual

            ativos.append((obj_id, cx, cy))

        for obj_id in list(self.objetos.keys()):
            if obj_id not in ids_usados:
                self.objetos[obj_id]["sumico"] += 1
                if self.objetos[obj_id]["sumico"] > FRAMES_MAX_SUMICO:
                    del self.objetos[obj_id]

        return ativos

    def reset(self):
        self.next_id = 0
        self.objetos = {}
        self.total_count = 0


_tracker = DefectTracker()


def get_defect_count() -> int:
    return _tracker.total_count


def reset_defect_count() -> None:
    _tracker.reset()


DISTANCIA_MAX_FUSAO_MESMO_FRAME = 40

AREA_MIN_PEQUENA = 10
AREA_MAX_PEQUENA = 3000

AREA_MIN_MANCHA = 3000
AREA_MAX_MANCHA = 200000

SOLIDEZ_MINIMA = 0.55
PROPORCAO_MAXIMA = 3.2

# Sensibilidade da diferença de cor. Menor = pega manchas mais fracas/pálidas.
LIMIAR_COR_AB = 9


def _fundir_centroides_proximos(centroides, boxes):
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
                    if dist < DISTANCIA_MAX_FUSAO_MESMO_FRAME:
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


def _mask_intensidade(gray_roi: np.ndarray) -> np.ndarray:
    """Máscara baseada em diferença de brilho (detecta furos, fiapos, sombras fortes)."""
    fundo = cv2.medianBlur(gray_roi, 41)
    diff = cv2.absdiff(gray_roi, fundo)
    diff = cv2.GaussianBlur(diff, (3, 3), 0)

    limiar_intensidade = 16
    _, mask = cv2.threshold(diff, limiar_intensidade, 255, cv2.THRESH_BINARY)
    return mask


def _mask_cor(roi_bgr: np.ndarray) -> np.ndarray:
    """
    Máscara baseada em diferença de COR (canais a/b do Lab), ignorando brilho.

    Usa a MEDIANA GLOBAL da ROI como referência de "cor neutra do tecido",
    em vez de um blur local. Isso evita o problema de manchas grandes
    ficarem "ocas" (só a borda detectada) quando a mancha é maior que a
    janela do blur local — nesse caso o blur local acaba usando a própria
    mancha como se fosse fundo, e o centro dela não gera diferença nenhuma.
    A mediana global é robusta a isso porque a mancha normalmente é
    minoria de pixels dentro da ROI inteira.
    """
    lab = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)

    ref_a = int(round(float(np.median(a_ch))))
    ref_b = int(round(float(np.median(b_ch))))

    diff_a = cv2.absdiff(a_ch, np.full_like(a_ch, ref_a))
    diff_b = cv2.absdiff(b_ch, np.full_like(b_ch, ref_b))

    diff_cor = cv2.addWeighted(diff_a, 0.5, diff_b, 0.5, 0)
    diff_cor = cv2.GaussianBlur(diff_cor, (5, 5), 0)

    _, mask = cv2.threshold(diff_cor, LIMIAR_COR_AB, 255, cv2.THRESH_BINARY)
    return mask


def _preencher_buracos(mask: np.ndarray) -> np.ndarray:
    """
    Preenche buracos internos na máscara (ex: mancha detectada só na borda,
    formando um anel). Faz flood-fill a partir do canto (fundo) e usa o
    complemento pra achar regiões fechadas por dentro, unindo de volta.
    """
    h, w = mask.shape[:2]
    mask_ff = mask.copy()
    flood_mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(mask_ff, flood_mask, (0, 0), 255)
    mask_ff_inv = cv2.bitwise_not(mask_ff)
    return cv2.bitwise_or(mask, mask_ff_inv)


def _contorno_parece_defeito(cont) -> bool:
    """Rejeita contornos em formato de linha/risco (sombra de dobra)."""
    area = cv2.contourArea(cont)
    if area <= 0:
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

    if area >= AREA_MIN_MANCHA:
        return solidez >= (SOLIDEZ_MINIMA - 0.15) and proporcao <= (PROPORCAO_MAXIMA + 1.0)

    return solidez >= SOLIDEZ_MINIMA and proporcao <= PROPORCAO_MAXIMA


def analyze_fabric(frame: np.ndarray, area_w_pct=60, area_h_pct=50) -> np.ndarray:
    result = frame.copy()
    h_frame, w_frame = frame.shape[:2]

    w_pct = max(1.0, min(100.0, float(area_w_pct)))
    h_pct = max(1.0, min(100.0, float(area_h_pct)))

    largura = max(2, int(w_frame * (w_pct / 100.0)))
    altura = max(2, int(h_frame * (h_pct / 100.0)))

    x_inicio = max(0, int(w_frame / 2 - largura / 2))
    y_inicio = max(0, int(h_frame / 2 - altura / 2))
    x_fim = min(w_frame, x_inicio + largura)
    y_fim = min(h_frame, y_inicio + altura)

    draw_dashed_rectangle(
        result,
        (x_inicio, y_inicio),
        (x_fim, y_fim),
        color=(255, 255, 255),
        thickness=2,
        dash_length=12,
        gap_length=8,
    )

    roi = frame[y_inicio:y_fim, x_inicio:x_fim]
    if roi.size == 0:
        return result

    gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    mask_intensidade = _mask_intensidade(gray_roi)
    mask_cor = _mask_cor(roi)
    mask = cv2.bitwise_or(mask_intensidade, mask_cor)

    kernel_morf = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_morf, iterations=1)

    kernel_fusao = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.dilate(mask, kernel_fusao, iterations=1)

    # Preenche buracos ANTES de procurar contornos, pra manchas grandes
    # virarem blob sólido em vez de anel.
    mask = _preencher_buracos(mask)

    contornos, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if LINHA_ORIENTACAO == "horizontal":
        linha_pos_abs = y_inicio + int(altura * (LINHA_POSICAO_PERCENT / 100.0))
        cv2.line(result, (x_inicio, linha_pos_abs), (x_fim, linha_pos_abs), (0, 165, 255), 2)
    else:
        linha_pos_abs = x_inicio + int(largura * (LINHA_POSICAO_PERCENT / 100.0))
        cv2.line(result, (linha_pos_abs, y_inicio), (linha_pos_abs, y_fim), (0, 165, 255), 2)

    centroides = []
    boxes_absolutos = []

    for cont in contornos:
        area = cv2.contourArea(cont)
        if not ((AREA_MIN_PEQUENA < area < AREA_MAX_PEQUENA) or (AREA_MIN_MANCHA <= area < AREA_MAX_MANCHA)):
            continue

        if not _contorno_parece_defeito(cont):
            continue

        x, y, w, h = cv2.boundingRect(cont)

        absoluto_x_inicio = x_inicio + x
        absoluto_y_inicio = y_inicio + y
        absoluto_x_fim = x_inicio + x + w
        absoluto_y_fim = y_inicio + y + h

        cx = absoluto_x_inicio + w // 2
        cy = absoluto_y_inicio + h // 2

        centroides.append((cx, cy))
        boxes_absolutos.append((absoluto_x_inicio, absoluto_y_inicio, absoluto_x_fim, absoluto_y_fim))

    centroides, boxes_absolutos = _fundir_centroides_proximos(centroides, boxes_absolutos)
    ativos = _tracker.update(centroides, linha_pos_abs)

    for (obj_id, cx, cy), box in zip(ativos, boxes_absolutos):
        bx0, by0, bx1, by1 = box
        cv2.rectangle(result, (bx0, by0), (bx1, by1), (0, 255, 0), 3)
        cv2.putText(result, f"#{obj_id}", (bx0, max(0, by0 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

    return result


def to_grayscale(frame: np.ndarray) -> np.ndarray:
    """Converte o frame original apenas para tons de cinza"""
    return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)