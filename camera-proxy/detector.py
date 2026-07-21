import cv2
import numpy as np

# ============================================================
# CONFIGURAÇÃO DA LINHA DE CONTAGEM (esteira em movimento)
# ============================================================
# Orientação da linha:
#   "horizontal" -> falha é contada quando cruza de cima pra baixo (ou vice-versa)
#   "vertical"   -> falha é contada quando cruza da esquerda pra direita (ou vice-versa)
# Escolha de acordo com o sentido real que o tecido anda na esteira em frente à câmera.
LINHA_ORIENTACAO = "vertical"

# Posição da linha DENTRO da ROI, em porcentagem (0 = topo/esquerda da ROI, 100 = fim da ROI)
LINHA_POSICAO_PERCENT = 50

# Distância máxima (em pixels) pra considerar que uma falha detectada agora é a
# MESMA falha detectada no frame anterior (rastreamento por proximidade)
DISTANCIA_MAX_RASTREIO = 90

# Quantos frames seguidos uma falha pode "sumir" (não ser detectada) antes de
# ser removida do rastreio (ex: saiu da ROI, ou detecção falhou por 1-2 frames)
FRAMES_MAX_SUMICO = 15


class DefectTracker:
    """Rastreia falhas entre frames e conta quantas cruzaram a linha de referência."""

    def __init__(self):
        self.next_id = 0
        self.objetos = {}  # id -> {"centroide": (cx, cy), "sumico": 0, "lado": None, "contado": False}
        self.total_count = 0

    def _lado_da_linha(self, cx, cy, linha_pos):
        if LINHA_ORIENTACAO == "horizontal":
            return "cima" if cy < linha_pos else "baixo"
        else:
            return "esquerda" if cx < linha_pos else "direita"

    def update(self, centroides, linha_pos):
        """
        centroides: lista de (cx, cy) das falhas detectadas no frame atual
        linha_pos: posição absoluta da linha (y se horizontal, x se vertical)
        retorna: lista de (id, cx, cy) das falhas ativas nesse frame, pra desenhar
        """
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
                self.objetos[obj_id] = {"centroide": (cx, cy), "sumico": 0, "lado": None, "contado": False}

            ids_usados.add(obj_id)
            dados = self.objetos[obj_id]
            dados["centroide"] = (cx, cy)
            dados["sumico"] = 0

            lado_atual = self._lado_da_linha(cx, cy, linha_pos)
            if dados["lado"] is None:
                dados["lado"] = lado_atual
            elif lado_atual != dados["lado"] and not dados["contado"]:
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
        """Zera a contagem e o rastreio (chamar no início de um novo rolo de tecido, por exemplo)"""
        self.next_id = 0
        self.objetos = {}
        self.total_count = 0


_tracker = DefectTracker()


def get_defect_count() -> int:
    """Retorna o total de falhas já contabilizadas desde o último reset"""
    return _tracker.total_count


def reset_defect_count() -> None:
    """Zera a contagem (ex: chamar quando começar a inspecionar um novo rolo/peça de tecido)"""
    _tracker.reset()

DISTANCIA_MAX_FUSAO_MESMO_FRAME = 50  # pixels; ajuste conforme o tamanho típico das falhas

# Filtro de falhas pequenas (furos, fiapos, pontos)
AREA_MIN_PEQUENA = 6
AREA_MAX_PEQUENA = 3000

# Filtro de manchas grandes (café, óleo, gordura, etc)
AREA_MIN_MANCHA = 3000
AREA_MAX_MANCHA = 200000  

def _fundir_centroides_proximos(centroides, boxes):
    """Agrupa centroides/boxes muito próximos no MESMO frame (provavelmente a mesma falha fragmentada)."""
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

        # busca por vizinhos próximos (inclusive vizinhos de vizinhos)
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

        # centroide médio do grupo
        gx = int(np.mean([centroides[g][0] for g in grupo_idx]))
        gy = int(np.mean([centroides[g][1] for g in grupo_idx]))
        novos_centroides.append((gx, gy))

        # box que envolve todo o grupo
        x0 = min(boxes[g][0] for g in grupo_idx)
        y0 = min(boxes[g][1] for g in grupo_idx)
        x1 = max(boxes[g][2] for g in grupo_idx)
        y1 = max(boxes[g][3] for g in grupo_idx)
        novos_boxes.append((x0, y0, x1, y1))

    return novos_centroides, novos_boxes


def analyze_fabric(frame: np.ndarray) -> np.ndarray:
    LIMIAR_INTENSIDADE_PEQUENA = 12 
    LIMIAR_INTENSIDADE_MANCHA = 6  
    result = frame.copy()

    h_frame, w_frame = frame.shape[:2]
    altura = 800
    largura = 1000

    x_inicio = int(w_frame / 2 - largura / 2)
    y_inicio = int(h_frame / 2 - altura / 2)
    x_fim = x_inicio + largura
    y_fim = y_inicio + altura

    cv2.rectangle(result, (x_inicio, y_inicio), (x_fim, y_fim), (255, 0, 0), 2)
    roi = frame[y_inicio:y_fim, x_inicio:x_fim]

    gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    kernel_fundo = 41
    fundo = cv2.medianBlur(gray_roi, kernel_fundo)
    diff = cv2.absdiff(gray_roi, fundo)
    diff = cv2.GaussianBlur(diff, (3, 3), 0)

    # ---------- MÁSCARA NORMAL: falhas pequenas (furos, fiapos) ----------
    _, mask_pequena = cv2.threshold(diff, LIMIAR_INTENSIDADE_PEQUENA, 255, cv2.THRESH_BINARY)
    kernel_morf = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask_pequena = cv2.morphologyEx(mask_pequena, cv2.MORPH_OPEN, kernel_morf, iterations=1)
    kernel_fusao = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask_pequena = cv2.dilate(mask_pequena, kernel_fusao, iterations=1)

    # ---------- MÁSCARA SENSÍVEL: manchas grandes de baixo contraste ----------
    _, mask_mancha = cv2.threshold(diff, LIMIAR_INTENSIDADE_MANCHA, 255, cv2.THRESH_BINARY)
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    mask_mancha = cv2.morphologyEx(mask_mancha, cv2.MORPH_CLOSE, kernel_close, iterations=2)
    mask_mancha = cv2.dilate(mask_mancha, kernel_close, iterations=1)

    if LINHA_ORIENTACAO == "horizontal":
        linha_pos_abs = y_inicio + int(altura * (LINHA_POSICAO_PERCENT / 100.0))
        cv2.line(result, (x_inicio, linha_pos_abs), (x_fim, linha_pos_abs), (0, 165, 255), 2)
    else:
        linha_pos_abs = x_inicio + int(largura * (LINHA_POSICAO_PERCENT / 100.0))
        cv2.line(result, (linha_pos_abs, y_inicio), (linha_pos_abs, y_fim), (0, 165, 255), 2)

    centroides = []
    boxes_absolutos = []

    def _extrair_contornos(mask, area_min, area_max):
        contornos, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cont in contornos:
            area = cv2.contourArea(cont)
            if area_min < area < area_max:
                x, y, w, h = cv2.boundingRect(cont)
                absoluto_x_inicio = x_inicio + x
                absoluto_y_inicio = y_inicio + y
                absoluto_x_fim = x_inicio + x + w
                absoluto_y_fim = y_inicio + y + h
                cx = absoluto_x_inicio + w // 2
                cy = absoluto_y_inicio + h // 2
                centroides.append((cx, cy))
                boxes_absolutos.append((absoluto_x_inicio, absoluto_y_inicio, absoluto_x_fim, absoluto_y_fim))

    # falhas pequenas vêm da máscara normal (mais limpa, menos ruído)
    _extrair_contornos(mask_pequena, AREA_MIN_PEQUENA, AREA_MAX_PEQUENA)
    # manchas grandes vêm da máscara sensível, só aceita se a área for grande o suficiente
    _extrair_contornos(mask_mancha, AREA_MIN_MANCHA, AREA_MAX_MANCHA)

    centroides, boxes_absolutos = _fundir_centroides_proximos(centroides, boxes_absolutos)
    ativos = _tracker.update(centroides, linha_pos_abs)

    for (obj_id, cx, cy), box in zip(ativos, boxes_absolutos):
        bx0, by0, bx1, by1 = box
        cv2.rectangle(result, (bx0, by0), (bx1, by1), (0, 255, 0), 3)
        cv2.putText(result, f"#{obj_id}", (bx0, max(0, by0 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

    cv2.putText(
        result,
        f"Falhas contadas: {_tracker.total_count}",
        (x_inicio, max(20, y_inicio - 15)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 165, 255),
        2,
    )

    return result


def to_grayscale(frame: np.ndarray) -> np.ndarray:
    """Converte o frame original apenas para tons de cinza"""
    return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)