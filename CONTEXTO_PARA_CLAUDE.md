# Contexto do Projeto: Inspeção de Tecidos (Integração YOLO)

Olá, Claude. Este documento foi gerado para te passar o contexto completo sobre o projeto atual de inspeção de tecidos. O objetivo principal agora é integrar a detecção de defeitos com YOLO, substituindo (ou mesclando) com o método clássico (cor/intensidade) atual.

## 1. Visão Geral
O sistema monitora defeitos em tecidos em tempo real. O fluxo de ponta a ponta funciona da seguinte forma:
- **Câmera RTSP**: Uma câmera IP da Hikvision transmite o vídeo (h.264).
- **Proxy FastAPI**: Um servidor em Python (`camera-proxy/server.py`) consome a RTSP usando OpenCV (com fallback para processo ffmpeg), aplica processamento frame a frame e expõe um stream de vídeo no formato MJPEG (`multipart/x-mixed-replace`).
- **Pipeline de Detecção**: Atualmente, usa-se processamento de imagem clássico (OpenCV) na classe `ColorDetector`. O YOLO já começou a ser integrado na classe `YoloDetector`, mas não está conectada no pipeline final.
- **Tracker**: `DefectTracker` rastreia o movimento (centroides) dos defeitos detectados ao longo dos frames e conta quando o defeito cruza uma linha de inspeção parametrizável.
- **Frontend**: Uma aplicação React em Next.js (`src/pages/ColorAnalysis.tsx`) que exibe a imagem em tempo real, permite alterar configurações do detector via rota `/detector-config` e puxa estatísticas via `/defect-count`.

**Tecnologias e Versões**:
- Backend Python: FastAPI, OpenCV (4.11.0), Ultralytics (8.4.152), Torch (2.14.0+cu130), Numpy (2.5.2).
- Frontend Web: Next.js, React, TailwindCSS.

## 2. Árvore de Pastas e Arquivos Importantes
```text
/home/lua/Documentos/fabric-analyzer-interface/
├── .env                              # Configurações de ambiente (RTSP, etc)
├── package.json                      # Dependências do Frontend
├── src/                              # Código-fonte Next.js
│   ├── pages/ColorAnalysis.tsx       # Tela principal que exibe a câmera e configurações
├── camera-proxy/                     # Backend Python
│   ├── server.py                     # Entrypoint do FastAPI (faz papel de main.py)
│   ├── detector.py                   # Classes Detection, DefectTracker, e ColorDetector
│   ├── yolo_detector.py              # Classe YoloDetector (em desenvolvimento)
│   ├── capture_snapshots.py          # Script para extrair frames da API para o dataset
│   ├── requirements.txt              # Pacotes do backend
│   ├── calibrated-color-reference.json # Arquivo gerado via UI com paleta de referência
│   └── models/
│       └── yolov8n.pt                # Modelo base (ainda não treinado no tecido)
├── dataset/                          # Pasta para treinar o YOLO (imagens e labels: 0 hoje)
│   ├── raw/
│   ├── images/
│   ├── labels/
│   ├── generate_data_yaml.py         # Script para gerar data.yaml baseado no detector.py
│   └── split_dataset.py              # Script para dividir raw/ em train/val
```
**Estatísticas do dataset**: Atualmente, as pastas `images/` e `labels/` não possuem nenhuma anotação nem imagem preenchidas (0 imagens, 0 anotações). 

## 3. Estado Atual da Integração com o YOLO
- **O que está feito**: A classe `YoloDetector` foi escrita (`camera-proxy/yolo_detector.py`) mapeando as classes da inferência para o objeto customizado `Detection`. Os scripts de manipulação de dataset (split_dataset e generate_data_yaml) estão prontos.
- **O que falta**: 
  1. Coletar imagens via script de snapshot, anotá-las e rodar o script de divisão.
  2. Treinar um modelo inicial do YOLO e salvar como `best.pt` na pasta `models/`.
  3. Modificar o pipeline principal (em `camera-proxy/server.py`) para permitir que o modelo instanciado mude de `ColorDetector` para `YoloDetector` dinamicamente ou fixamente.
- **Modelo treinado**: Não existe. Apenas o `yolov8n.pt` cru padrão.
- **Erros**: Nenhum erro de sintaxe ou execução do YOLO no momento, ele simplesmente não é chamado pelo `server.py` que instancia direto `global_detector = ColorDetector()`.

## 4. Pontos de Integração
- **Troca de detector**: No momento, a escolha no pipeline é inexistente. O código roda direto o `ColorDetector`. A variável `global_detector` precisará receber o `YoloDetector`.
- **ROI (Region of Interest)**: Definida no front pelas variáveis `w` (largura %) e `h` (altura %). O frame é cortado neste ROI e passado ao `.detect()` e a saída `Detection` é reajustada para coordenadas absolutas e enviada ao Tracker.
- **Tracker**: Atualizado passando `ativos = global_tracker.update(fixed_abs_detections, linha_pos_abs)`. O defeito soma na contagem se cruzar a linha referencial.
- **Frontend**: Comunica-se com os endpoints `GET/POST /detector-config` para mudar o ROI, `linha_orientacao` e cor. E realiza pooling em `/defect-count` para puxar a contagem rastreada. Usa `/stream-analyzed.mjpg` passando os parâmetros de altura/largura pela querystring.

## 5. Ambiente
- **OS**: Linux Ubuntu
- **Processador e RAM**: 11th Gen Intel i5-11400H, ~15GB de Memória RAM.
- **GPU**: Presente (PyTorch relata +cu130 para CUDA).
- **Python**: venv com Python 3 (geralmente executando via `uvicorn server:app`).
- **Ffmpeg**: Instalado localmente, versão 6.1.1. Usado como fallback no proxy da câmera em caso de falha do OpenCV.

## 6. Câmera e Cenário Real
- **Câmera**: Hikvision IP (RTSP), transmitindo a cerca de 8 a 12 FPS (variável `OUTPUT_FPS`).
- **Dinâmica**: O tecido entra em movimento na esteira e os defeitos percorrem a imagem até cruzar a linha configurada de rastreio.
- **Defeitos (Ordem Obrigatória)**: `["furo", "mancha", "fio_puxado", "tonalidade"]`
- **Ferramenta de anotação**: Fica a meu critério escolher depois para anotar as imagens para o treinamento.

---
## 7. Arquivos na Íntegra (Código)

### `.env` (mascarado)
```env
CAMERA_IP=192.168.1.64
CAMERA_RTSP_PORT=554
CAMERA_USER=admin
CAMERA_PASSWORD=***
CAMERA_CHANNEL=101
#CAMERA_RTSP_URL=rtsp://admin:senha@192.168.1.64:554/Streaming/Channels/101
OUTPUT_FPS=8
JPEG_QUALITY=80
CONNECT_TIMEOUT_SECONDS=5
DATABASE_URL=postgresql://app_user:app_password@localhost:5433/fabric_analyzer
SESSION_SECRET=fabric-analyzer-session-secret-2026
```

### `camera-proxy/server.py` (Atua como main.py da API/Proxy)
```python
import os
import json
import threading
import time
from typing import Optional
from pathlib import Path
import subprocess
import logging

import cv2
import numpy as np
from detector import to_grayscale, ColorDetector, DefectTracker, Visualizer, Detection
from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
import random 

load_dotenv()

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
CAMERA_IP = os.getenv("CAMERA_IP", "192.168.1.64")
CAMERA_RTSP_PORT = int(os.getenv("CAMERA_RTSP_PORT", "554"))
CAMERA_USER = os.getenv("CAMERA_USER", "admin")
CAMERA_PASSWORD = os.getenv("CAMERA_PASSWORD")
CAMERA_CHANNEL = os.getenv("CAMERA_CHANNEL", "101")

if not CAMERA_PASSWORD:
    raise RuntimeError(
        "CAMERA_PASSWORD must be set in the environment before starting the camera proxy."
    )

CAMERA_RTSP_URL = os.getenv(
    "CAMERA_RTSP_URL",
    f"rtsp://{CAMERA_USER}:{CAMERA_PASSWORD}@{CAMERA_IP}:{CAMERA_RTSP_PORT}/Streaming/Channels/{CAMERA_CHANNEL}",
)
OUTPUT_FPS = float(os.getenv("OUTPUT_FPS", "12"))
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "80"))
CONNECT_TIMEOUT_SECONDS = float(os.getenv("CONNECT_TIMEOUT_SECONDS", "5"))
COLOR_REFERENCE_PATH = Path(
    os.getenv(
        "COLOR_REFERENCE_PATH",
        str(Path(__file__).with_name("calibrated-color-reference.json")),
    )
)

# Fallback to using ffmpeg subprocess for more robust H.264 handling
USE_FFMPEG_FALLBACK = os.getenv("USE_FFMPEG_FALLBACK", "1") != "0"

logging.basicConfig(level=logging.INFO)
_log = logging.getLogger("camera-proxy")


def _load_color_reference() -> tuple[Optional[int], Optional[int], Optional[list]]:
    try:
        saved = json.loads(COLOR_REFERENCE_PATH.read_text(encoding="utf-8"))
        ref_a = int(saved["ref_a"]) if "ref_a" in saved else None
        ref_b = int(saved["ref_b"]) if "ref_b" in saved else None
        paleta_raw = saved.get("paleta")
        paleta = None
        if isinstance(paleta_raw, list) and paleta_raw:
            paleta = [(int(p[0]), int(p[1])) for p in paleta_raw]
        return ref_a, ref_b, paleta
    except (FileNotFoundError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        pass
    return None, None, None

color_reference_lock = threading.Lock()
saved_ref_a, saved_ref_b, saved_paleta = _load_color_reference()
N_CORES_PALETA = 3

app = FastAPI(title="hikvision-camera-proxy", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/reference-palette")
def save_reference_palette(payload: dict = Body(...)) -> JSONResponse:
    global saved_ref_a, saved_ref_b, saved_paleta

    samples = payload.get("samples")
    if not isinstance(samples, list) or len(samples) == 0:
        raise HTTPException(status_code=400, detail="Informe 'samples': lista de {r,g,b}")

    lab_points = []
    for s in samples:
        try:
            r, g, b = int(s["r"]), int(s["g"]), int(s["b"])
        except (KeyError, TypeError, ValueError):
            continue
        if not all(0 <= v <= 255 for v in (r, g, b)):
            continue
        rgb_arr = np.uint8([[[r, g, b]]])
        lab_arr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2LAB)
        lab_points.append([float(lab_arr[0, 0, 1]), float(lab_arr[0, 0, 2])])

    if not lab_points:
        raise HTTPException(status_code=400, detail="Nenhuma amostra valida em 'samples'")

    data = np.array(lab_points, dtype=np.float32)
    k = min(N_CORES_PALETA, len(data))

    if k == 1:
        centers = np.array([[float(np.mean(data[:, 0])), float(np.mean(data[:, 1]))]])
    else:
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
        _, _, centers = cv2.kmeans(data, k, None, criteria, 5, cv2.KMEANS_PP_CENTERS)

    paleta = [(int(round(c[0])), int(round(c[1]))) for c in centers]

    ref_a = paleta[0][0]
    ref_b = paleta[0][1]

    reference = {"ref_a": ref_a, "ref_b": ref_b, "paleta": [list(p) for p in paleta]}

    try:
        COLOR_REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = COLOR_REFERENCE_PATH.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(reference), encoding="utf-8")
        temporary_path.replace(COLOR_REFERENCE_PATH)
    except OSError as error:
        _log.error("Não foi possível salvar a paleta de cor: %s", error)
        raise HTTPException(status_code=500, detail="Falha ao salvar paleta de cor")

    with color_reference_lock:
        saved_ref_a, saved_ref_b, saved_paleta = ref_a, ref_b, paleta

    return JSONResponse({"ref_a": ref_a, "ref_b": ref_b, "paleta": paleta, "n_cores": len(paleta)})

class CameraState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.latest_frame: Optional[bytes] = None
        self.last_frame_ts = 0.0
        self.connected = False
        self.running = True
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()
        self._ffmpeg_thread: Optional[threading.Thread] = None

    def _capture_loop(self) -> None:
        backoff = 1.0
        while self.running:
            try:
                _log.info("Attempting OpenCV capture...")
                capture = cv2.VideoCapture(CAMERA_RTSP_URL, cv2.CAP_FFMPEG)
                try:
                    capture.set(cv2.CAP_PROP_BUFFERSIZE, 4)
                except Exception:
                    pass
                try:
                    capture.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
                    capture.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
                except Exception:
                    pass
                
                started_at = time.time()
                self.connected = capture.isOpened()

                if not self.connected:
                    _log.warning("OpenCV failed to open RTSP stream, will retry or fallback")
                    capture.release()
                    if USE_FFMPEG_FALLBACK:
                        self._start_ffmpeg_fallback()
                        return
                    time.sleep(min(backoff, 10.0))
                    backoff = min(backoff * 2, 10.0)
                    continue

                backoff = 1.0

                while self.running:
                    ok, frame = capture.read()
                    if not ok:
                        self.connected = False
                        _log.warning("OpenCV read returned not ok, breaking to reconnect")
                        break

                    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                    encoded_ok, jpg = cv2.imencode(".jpg", frame, encode_params)
                    if not encoded_ok:
                        continue

                    with self.lock:
                        self.latest_frame = jpg.tobytes()
                        self.last_frame_ts = time.time()
                        self.connected = True

                    if time.time() - started_at > CONNECT_TIMEOUT_SECONDS and self.last_frame_ts == 0:
                        self.connected = False
                        break

                capture.release()
                time.sleep(0.5)
            except Exception as e:
                _log.exception("Unexpected error in capture loop: %s", e)
                time.sleep(1.0)

    def stop(self) -> None:
        self.running = False
        self.thread.join(timeout=1.0)
        if self._ffmpeg_thread and self._ffmpeg_thread.is_alive():
            self._ffmpeg_thread.join(timeout=1.0)

    def _start_ffmpeg_fallback(self) -> None:
        if self._ffmpeg_thread and self._ffmpeg_thread.is_alive():
            return
        self._ffmpeg_thread = threading.Thread(target=self._ffmpeg_loop, daemon=True)
        self._ffmpeg_thread.start()

    def _ffmpeg_loop(self) -> None:
        _log.info("Starting ffmpeg fallback loop")
        backoff = 1.0
        while self.running:
            cmd = [
                "ffmpeg",
                "-rtsp_transport", "tcp",
                "-i", CAMERA_RTSP_URL,
                "-f", "mjpeg",
                "-q:v", "5",
                "-r", str(int(OUTPUT_FPS)),
                "pipe:1",
            ]
            try:
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                stdout = proc.stdout
                buffer = b""

                while self.running:
                    if stdout is None:
                        break
                    chunk = stdout.read(4096)
                    if not chunk:
                        break
                    buffer += chunk

                    while True:
                        start = buffer.find(b"\xff\xd8")
                        end = buffer.find(b"\xff\xd9", start + 2) if start != -1 else -1
                        if start != -1 and end != -1:
                            jpg = buffer[start:end + 2]
                            buffer = buffer[end + 2 :]
                            with self.lock:
                                self.latest_frame = jpg
                                self.last_frame_ts = time.time()
                                self.connected = True
                        else:
                            break
                try:
                    proc.kill()
                except Exception:
                    pass
            except FileNotFoundError:
                _log.error("ffmpeg not found in PATH.")
                break
            except Exception as e:
                _log.exception("ffmpeg loop error: %s", e)

            if not self.running:
                break
            time.sleep(backoff)
            backoff = min(backoff * 2, 30.0)


camera_state = CameraState()

from pydantic import BaseModel

class DetectorConfig(BaseModel):
    w: int = 60
    h: int = 50
    apenas_area: bool = False
    estampado: bool = False
    ref_a: Optional[int] = None
    ref_b: Optional[int] = None
    linha_orientacao: str = "vertical"
    linha_posicao_percent: int = 50

current_detector_config = DetectorConfig()
detector_lock = threading.Lock()
global_tracker = DefectTracker()
global_detector = ColorDetector()

class PipelineState:
    def __init__(self):
        self.lock = threading.Lock()
        self.latest_analyzed_frame: Optional[bytes] = None

pipeline_state = PipelineState()

def pipeline_worker():
    frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08
    while True:
        if not camera_state.running:
            break
            
        started_at = time.time()
        
        with camera_state.lock:
            frame_bytes = camera_state.latest_frame
            
        if frame_bytes is None:
            time.sleep(0.1)
            continue
            
        try:
            frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
            frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
            
            if frame is not None:
                with detector_lock:
                    config_dict = current_detector_config.dict()
                    
                w_pct = config_dict.get("w", 60)
                h_pct = config_dict.get("h", 50)
                h_frame, w_frame = frame.shape[:2]
                largura = max(2, int(w_frame * (w_pct / 100.0)))
                altura = max(2, int(h_frame * (h_pct / 100.0)))
                x_inicio = max(0, int(w_frame / 2 - largura / 2))
                y_inicio = max(0, int(h_frame / 2 - altura / 2))
                x_fim = min(w_frame, x_inicio + largura)
                y_fim = min(h_frame, y_inicio + altura)
                
                roi = frame[y_inicio:y_fim, x_inicio:x_fim]
                
                if not config_dict.get("apenas_area", False) and roi.size > 0:
                    with color_reference_lock:
                        if config_dict.get("ref_a") is None and config_dict.get("ref_b") is None:
                            config_dict["paleta"] = saved_paleta
                            config_dict["ref_a"] = saved_ref_a
                            config_dict["ref_b"] = saved_ref_b
                            
                    detections = global_detector.detect(roi, config_dict)
                    
                    fixed_abs_detections = []
                    for det in detections:
                        abs_bx0 = det.box[0] + x_inicio
                        abs_by0 = det.box[1] + y_inicio
                        abs_bx1 = det.box[2] + x_inicio
                        abs_by1 = det.box[3] + y_inicio
                        abs_cx = det.centroid[0] + x_inicio
                        abs_cy = det.centroid[1] + y_inicio
                        fixed_abs_detections.append(
                            Detection(
                                box=(abs_bx0, abs_by0, abs_bx1, abs_by1),
                                centroid=(abs_cx, abs_cy),
                                area=det.area,
                                label=det.label,
                                confidence=det.confidence,
                            )
                        )
                        
                    if config_dict.get("linha_orientacao", "vertical") == "horizontal":
                        linha_pos_abs = y_inicio + int(altura * (config_dict.get("linha_posicao_percent", 50) / 100.0))
                    else:
                        linha_pos_abs = x_inicio + int(largura * (config_dict.get("linha_posicao_percent", 50) / 100.0))
                        
                    ativos = global_tracker.update(fixed_abs_detections, linha_pos_abs)
                    
                    processed_frame = Visualizer.draw_results(frame, config_dict, ativos, fixed_abs_detections, x_inicio, y_inicio, x_fim, y_fim)
                else:
                    processed_frame = Visualizer.draw_results(frame, config_dict, [], [], x_inicio, y_inicio, x_fim, y_fim)

                encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                encoded_ok, jpg = cv2.imencode(".jpg", processed_frame, encode_params)
                if encoded_ok:
                    with pipeline_state.lock:
                        pipeline_state.latest_analyzed_frame = jpg.tobytes()
        except Exception as e:
            _log.error(f"Erro no pipeline worker: {e}")
            
        elapsed = time.time() - started_at
        sleep_time = max(0, frame_interval - elapsed)
        time.sleep(sleep_time)

pipeline_thread = threading.Thread(target=pipeline_worker, daemon=True)
pipeline_thread.start()

@app.post("/detector-config")
def update_detector_config(config: DetectorConfig) -> JSONResponse:
    global current_detector_config
    with detector_lock:
        current_detector_config = config
    return JSONResponse(current_detector_config.dict())

@app.get("/detector-config")
def get_detector_config() -> JSONResponse:
    with detector_lock:
        return JSONResponse(current_detector_config.dict())

@app.get("/health")
def health() -> JSONResponse:
    age_seconds = max(0.0, time.time() - camera_state.last_frame_ts) if camera_state.last_frame_ts else None
    return JSONResponse(
        {
            "connected": camera_state.connected,
            "last_frame_age_seconds": age_seconds,
            "camera_ip": CAMERA_IP,
            "camera_channel": CAMERA_CHANNEL,
        }
    )

@app.get("/stream.mjpg")
def stream_mjpeg() -> StreamingResponse:
    boundary = "frame"
    def frame_generator():
        frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08
        while True:
            with camera_state.lock:
                frame = camera_state.latest_frame
            if frame is None:
                time.sleep(0.1)
                continue
            yield (
                b"--" + boundary.encode() + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
                + frame
                + b"\r\n"
            )
            time.sleep(frame_interval)

    return StreamingResponse(
        frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )

@app.get("/stream-analyzed.mjpg")
def stream_analyzed_mjpeg() -> StreamingResponse:
    boundary = "frame"
    def analyzed_frame_generator():
        frame_interval = 1.0 / OUTPUT_FPS if OUTPUT_FPS > 0 else 0.08
        while True:
            with pipeline_state.lock:
                jpg_bytes = pipeline_state.latest_analyzed_frame
            if jpg_bytes is None:
                time.sleep(0.1)
                continue
            try:
                yield (
                    b"--" + boundary.encode() + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpg_bytes)).encode() + b"\r\n\r\n"
                    + jpg_bytes
                    + b"\r\n"
                )
            except Exception as e:
                break
            time.sleep(frame_interval)

    return StreamingResponse(
        analyzed_frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )

@app.post("/reference-color")
def save_reference_color(payload: dict = Body(...)) -> JSONResponse:
    global saved_ref_a, saved_ref_b, saved_paleta
    try:
        ref_r = int(payload["r"])
        ref_g = int(payload["g"])
        ref_b = int(payload["b"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Informe r, g e b")

    reference_rgb = np.uint8([[[ref_r, ref_g, ref_b]]])
    reference_lab = cv2.cvtColor(reference_rgb, cv2.COLOR_RGB2LAB)
    ref_a = int(reference_lab[0, 0, 1])
    ref_b = int(reference_lab[0, 0, 2])
    paleta = [(ref_a, ref_b)]
    reference = {"ref_a": ref_a, "ref_b": ref_b, "paleta": [list(p) for p in paleta]}

    try:
        COLOR_REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = COLOR_REFERENCE_PATH.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(reference), encoding="utf-8")
        temporary_path.replace(COLOR_REFERENCE_PATH)
    except OSError as error:
        raise HTTPException(status_code=500, detail="Falha")

    with color_reference_lock:
        saved_ref_a, saved_ref_b, saved_paleta = ref_a, ref_b, paleta

    return JSONResponse({"ref_a": ref_a, "ref_b": ref_b})

@app.get("/defect-count")
def defect_count() -> JSONResponse:
    return JSONResponse({"count": global_tracker.total_count})


@app.post("/reset-count")
def reset_count() -> JSONResponse:
    global_tracker.reset()
    return JSONResponse({"success": True, "count": global_tracker.total_count})

def _decode_latest_frame() -> np.ndarray:
    with camera_state.lock:
        frame_bytes = camera_state.latest_frame
    if frame_bytes is None:
        raise HTTPException(status_code=503, detail="Nenhum frame disponivel no momento")
    frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
    frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
    return frame

@app.get("/snapshot.jpg")
def snapshot() -> Response:
    with camera_state.lock:
        frame_bytes = camera_state.latest_frame
    if frame_bytes is None:
        raise HTTPException(status_code=503, detail="Nenhum frame")
    return Response(content=frame_bytes, media_type="image/jpeg")

# [Omitidos métodos de calibração de cor e estatísticas adicionais que não alteram o pipeline visual principal]
```

### `camera-proxy/detector.py`
```python
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional, List, Tuple, Dict, Any

DEFECT_CLASSES = ["furo", "mancha", "fio_puxado", "tonalidade"]

@dataclass
class Detection:
    box: Tuple[int, int, int, int]  # (x0, y0, x1, y1)
    centroid: Tuple[int, int]
    area: float
    label: Optional[str] = None
    confidence: Optional[float] = None

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
    def __init__(self, ...):
        # [Parâmetros de configuração e funções utilitárias omitidas para não sobrecarregar - ColorDetector processa cores baseadas no Lab e morfologia e retorna instâncias de Detection]

    def detect(self, roi: np.ndarray, config: dict) -> List[Detection]:
        # [...] Lógica de gerar máscara, buscar contornos, filtrar por área...
        # Ao fim ele gera a lista das detecções e os boxes:
        detections = []
        for (cx, cy), (bx0, by0, bx1, by1) in zip(centroides, boxes):
            w = bx1 - bx0
            h = by1 - by0
            detections.append(Detection(box=(bx0, by0, bx1, by1), centroid=(cx, cy), area=float(w * h)))
        return detections


class Visualizer:
    @staticmethod
    def draw_dashed_rectangle(img, pt1, pt2, color, thickness=2, dash_length=10, gap_length=6):
        # ...

    @staticmethod
    def draw_results(frame: np.ndarray, config: dict, ativos: List[Tuple[int, int, int]], abs_detections: List[Detection], x_inicio: int, y_inicio: int, x_fim: int, y_fim: int) -> np.ndarray:
        result = frame.copy()

        Visualizer.draw_dashed_rectangle(
            result, (x_inicio, y_inicio), (x_fim, y_fim),
            color=(255, 255, 255), thickness=2, dash_length=12, gap_length=8,
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
            label_text = f"#{obj_id}"
            if det.label:
                label_text += f" {det.label}"
            if det.confidence is not None:
                label_text += f" ({det.confidence:.2f})"
            cv2.putText(result, label_text, (abs_bx0, max(0, abs_by0 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        return result

def to_grayscale(frame: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
```

### `camera-proxy/yolo_detector.py`
```python
from typing import List, Optional
import numpy as np
from ultralytics import YOLO
from detector import BaseDetector, Detection, DEFECT_CLASSES

class YoloDetector(BaseDetector):
    """
    Detector de defeitos baseado em YOLO.
    Concentra o carregamento do modelo, pré/pós-processamento e mapeamento
    das detecções para o formato reutilizável `Detection`.
    """
    def __init__(self, model_path: str = "models/yolov8n.pt", conf_threshold: float = 0.25):
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.model = YOLO(model_path)

    def detect(self, roi: np.ndarray, config: dict) -> List[Detection]:
        conf = config.get("yolo_conf", self.conf_threshold)
        results = self.model(roi, conf=conf, verbose=False)
        if not results or len(results) == 0:
            return []

        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            return []

        coordinates = boxes.xyxy.cpu().numpy().astype(np.int32, copy=False)
        confs = boxes.conf.cpu().numpy()
        classes = boxes.cls.cpu().numpy().astype(np.int32, copy=False)

        detections = []
        for (x0, y0, x1, y1), c_conf, cls_idx in zip(coordinates, confs, classes):
            label = DEFECT_CLASSES[cls_idx] if 0 <= cls_idx < len(DEFECT_CLASSES) else str(cls_idx)
            w = x1 - x0
            h = y1 - y0
            detections.append(
                Detection(
                    box=(int(x0), int(y0), int(x1), int(y1)),
                    centroid=(int((x0 + x1) // 2), int((y0 + y1) // 2)),
                    area=float(w * h),
                    label=label,
                    confidence=float(c_conf),
                )
            )
        return detections
```

### `camera-proxy/capture_snapshots.py`
```python
#!/usr/bin/env python3
"""
capture_snapshots.py

Script para capturar frames do endpoint /snapshot.jpg em intervalos regulares
e salvá-los no diretório de dataset bruto (dataset/raw/).
"""

import argparse
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Captura snapshots do camera-proxy em intervalos regulares para montagem de dataset."
    )
    parser.add_argument(
        "--url",
        type=str,
        default="http://localhost:8090/snapshot.jpg",
        help="URL do endpoint de snapshot (default: http://localhost:8090/snapshot.jpg)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=2.0,
        help="Intervalo entre capturas em segundos (default: 2.0)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="dataset/raw",
        help="Diretório de saída para salvar os frames (default: dataset/raw)",
    )
    parser.add_argument(
        "--prefix",
        type=str,
        default="frame",
        help="Prefixo do nome dos arquivos salvos (default: frame)",
    )
    parser.add_argument(
        "--max-count",
        type=int,
        default=0,
        help="Quantidade máxima de frames a capturar (0 = ilimitado)",
    )
    parser.add_argument(
        "--max-minutes",
        type=float,
        default=0.0,
        help="Tempo máximo de captura em minutos (0 = ilimitado)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=5.0,
        help="Timeout HTTP da requisição em segundos (default: 5.0)",
    )
    parser.add_argument(
        "--max-failures",
        type=int,
        default=10,
        help="Número máximo de falhas de conexão consecutivas antes de parar (default: 10)",
    )

    args = parser.parse_args()

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"=== Iniciando captura de snapshots ===")
    print(f"Endpoint: {args.url}")
    print(f"Intervalo: {args.interval}s")
    print(f"Diretório de saída: {out_dir.resolve()}")
    print(f"Prefixo: {args.prefix}")
    if args.max_count > 0:
        print(f"Limite de frames: {args.max_count}")
    if args.max_minutes > 0:
        print(f"Limite de tempo: {args.max_minutes} minuto(s)")
    print("Pressione Ctrl+C para interromper a captura a qualquer momento.\n")

    captured_count = 0
    consecutive_failures = 0
    start_time = time.time()

    try:
        while True:
            # Verifica limite de tempo
            elapsed_minutes = (time.time() - start_time) / 60.0
            if args.max_minutes > 0 and elapsed_minutes >= args.max_minutes:
                print(f"\n[INFO] Tempo máximo de captura atingido ({args.max_minutes} min). Encerrando.")
                break

            # Verifica limite de quantidade
            if args.max_count > 0 and captured_count >= args.max_count:
                print(f"\n[INFO] Limite máximo de {args.max_count} frames atingido. Encerrando.")
                break

            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{args.prefix}_{timestamp_str}_{captured_count + 1:04d}.jpg"
            filepath = out_dir / filename

            try:
                req = urllib.request.Request(
                    args.url,
                    headers={"User-Agent": "FabricAnalyzer-SnapshotCapturer/1.0"},
                )
                with urllib.request.urlopen(req, timeout=args.timeout) as response:
                    if response.status == 200:
                        image_bytes = response.read()
                        filepath.write_bytes(image_bytes)
                        captured_count += 1
                        consecutive_failures = 0
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved #{captured_count}: {filepath.name} ({len(image_bytes)} bytes)")
                    else:
                        consecutive_failures += 1
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] [ERRO] HTTP {response.status}. Falhas consecutivas: {consecutive_failures}/{args.max_failures}")
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as err:
                consecutive_failures += 1
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [ERRO] Falha ao conectar: {err}. Falhas consecutivas: {consecutive_failures}/{args.max_failures}")

            if consecutive_failures >= args.max_failures:
                print(f"\n[ERRO CRÍTICO] Limite de {args.max_failures} falhas de conexão consecutivas atingido. Encerrando captura.")
                sys.exit(1)

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\n[INFO] Captura interrompida pelo usuário.")

    total_duration = time.time() - start_time
    print(f"\n=== Resumo da Captura ===")
    print(f"Total de frames salvos: {captured_count}")
    print(f"Duração total: {total_duration / 60.0:.2f} minutos")
    print(f"Local das imagens: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
```

### `camera-proxy/requirements.txt`
```txt
fastapi==0.115.11
uvicorn==0.34.0
opencv-python==4.11.0.86
python-dotenv==1.0.1
ultralytics
torch
torchvision
torchaudio
numpy
```

### `camera-proxy/calibrated-color-reference.json`
```json
{"ref_a": 128, "ref_b": 122, "paleta": [[128, 122], [130, 127], [128, 129]]}
```

### `dataset/generate_data_yaml.py`
```python
#!/usr/bin/env python3
"""
generate_data_yaml.py

Gera/atualiza o arquivo dataset/data.yaml para o YOLO importando
diretamente as classes de DEFECT_CLASSES em camera-proxy/detector.py.
"""

import sys
from pathlib import Path

# Adiciona o diretório camera-proxy ao sys.path para importar detector.py
current_dir = Path(__file__).resolve().parent
root_dir = current_dir.parent
camera_proxy_dir = root_dir / "camera-proxy"

if str(camera_proxy_dir) not in sys.path:
    sys.path.insert(0, str(camera_proxy_dir))

try:
    from detector import DEFECT_CLASSES
except ImportError as err:
    print(f"[ERRO] Não foi possível importar DEFECT_CLASSES de detector.py: {err}")
    sys.exit(1)


def generate_data_yaml(yaml_path: Path = None):
    if yaml_path is None:
        yaml_path = current_dir / "data.yaml"

    names_dict = {i: name for i, name in enumerate(DEFECT_CLASSES)}

    lines = [
        "# Autogenerated from camera-proxy/detector.py (DEFECT_CLASSES)",
        "path: .",
        "train: images/train",
        "val: images/val",
        "",
        "names:",
    ]
    for idx, name in names_dict.items():
        lines.append(f"  {idx}: {name}")

    yaml_content = "\n".join(lines) + "\n"
    yaml_path.write_text(yaml_content, encoding="utf-8")
    print(f"[INFO] {yaml_path} gerado com sucesso!")
    print(f"Classes ({len(DEFECT_CLASSES)}): {DEFECT_CLASSES}")


if __name__ == "__main__":
    generate_data_yaml()
```

### `dataset/split_dataset.py`
```python
#!/usr/bin/env python3
"""
split_dataset.py

Divide as imagens anotadas (pares .jpg / .txt) localizadas no diretório de origem
(default: dataset/raw) nas pastas de treino (80%) e validação (20%) em:
- dataset/images/train e dataset/labels/train
- dataset/images/val e dataset/labels/val

Move sempre o par (imagem + label) junto com seed fixa para reprodutibilidade.
"""

import argparse
import random
import shutil
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Divide um dataset de pares (imagem + label txt) em treino e validação (YOLO)."
    )
    parser.add_argument(
        "--source",
        type=str,
        default="dataset/raw",
        help="Diretório de origem contendo as imagens e arquivos .txt anotados (default: dataset/raw)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="dataset",
        help="Diretório raiz do dataset de saída (default: dataset)",
    )
    parser.add_argument(
        "--ratio",
        type=float,
        default=0.8,
        help="Proporção do conjunto de treino (ex: 0.8 = 80%% treino, 20%% val) (default: 0.8)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Semente aleatória para reprodutibilidade da divisão (default: 42)",
    )
    parser.add_argument(
        "--copy",
        action="store_true",
        help="Copiar arquivos em vez de mover (default: move os arquivos)",
    )

    args = parser.parse_args()

    if not 0.0 < args.ratio < 1.0:
        print(f"[ERRO] O parâmetro --ratio deve estar entre 0.0 e 1.0. Valor informado: {args.ratio}")
        sys.exit(1)

    source_dir = Path(args.source).resolve()
    output_dir = Path(args.output_dir).resolve()

    if not source_dir.exists():
        print(f"[ERRO] Diretório de origem '{source_dir}' não existe.")
        sys.exit(1)

    img_train_dir = output_dir / "images" / "train"
    img_val_dir = output_dir / "images" / "val"
    lbl_train_dir = output_dir / "labels" / "train"
    lbl_val_dir = output_dir / "labels" / "val"

    for d in [img_train_dir, img_val_dir, lbl_train_dir, lbl_val_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Suporta extensões comuns de imagens
    valid_extensions = {".jpg", ".jpeg", ".png", ".bmp"}
    all_files = list(source_dir.iterdir())
    image_files = [f for f in all_files if f.is_file() and f.suffix.lower() in valid_extensions]

    valid_pairs = []
    orphaned_images = []
    orphaned_labels = []

    for img_path in image_files:
        lbl_path = img_path.with_suffix(".txt")
        if lbl_path.exists() and lbl_path.is_file():
            valid_pairs.append((img_path, lbl_path))
        else:
            orphaned_images.append(img_path)

    # Verifica se há arquivos txt órfãos (sem imagem correspondente)
    label_files = [f for f in all_files if f.is_file() and f.suffix.lower() == ".txt"]
    for lbl_path in label_files:
        has_img = any(lbl_path.with_suffix(ext).exists() for ext in valid_extensions)
        if not has_img:
            orphaned_labels.append(lbl_path)

    print(f"=== Processando divisão do dataset ===")
    print(f"Origem: {source_dir}")
    print(f"Destino: {output_dir}")
    print(f"Proporção Treino/Val: {int(args.ratio * 100)}% / {int((1 - args.ratio) * 100)}%")
    print(f"Semente aleatória: {args.seed}")
    print(f"Pares válidos (imagem + txt) encontrados: {len(valid_pairs)}")

    if orphaned_images:
        print(f"[AVISO] Imagens sem arquivo .txt de anotação correspondente: {len(orphaned_images)}")
    if orphaned_labels:
        print(f"[AVISO] Arquivos .txt sem imagem correspondente: {len(orphaned_labels)}")

    if not valid_pairs:
        print(f"[AVISO] Nenhum par de (imagem + label .txt) foi encontrado em '{source_dir}'. Encerrando sem alterações.")
        sys.exit(0)

    # Ordenação antes do shuffle garante deterministicidade cruzando SOs
    valid_pairs.sort(key=lambda x: x[0].name)
    random.seed(args.seed)
    random.shuffle(valid_pairs)

    split_idx = int(len(valid_pairs) * args.ratio)
    train_pairs = valid_pairs[:split_idx]
    val_pairs = valid_pairs[split_idx:]

    action_func = shutil.copy2 if args.copy else shutil.move
    action_name = "Copiados" if args.copy else "Movidos"

    # Processa treino
    for img_path, lbl_path in train_pairs:
        action_func(img_path, img_train_dir / img_path.name)
        action_func(lbl_path, lbl_train_dir / lbl_path.name)

    # Processa validação
    for img_path, lbl_path in val_pairs:
        action_func(img_path, img_val_dir / img_path.name)
        action_func(lbl_path, lbl_val_dir / lbl_path.name)

    print(f"\n=== Divisão Concluída ===")
    print(f"Conjunto de Treino ({action_name}): {len(train_pairs)} pares")
    print(f"  - Imagens: {img_train_dir}")
    print(f"  - Labels:  {lbl_train_dir}")
    print(f"Conjunto de Validação ({action_name}): {len(val_pairs)} pares")
    print(f"  - Imagens: {img_val_dir}")
    print(f"  - Labels:  {lbl_val_dir}")

if __name__ == "__main__":
    main()
```

### `src/pages/ColorAnalysis.tsx` (Trechos do arquivo conectando à API)
```typescript
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
// ... (imports omitidos para brevidade)
const CAMERA_API_URL = "http://localhost:8090";

const ColorAnalysis = ({ analysisType = "tecido" }: ColorAnalysisProps) => {
  // ...
  const [defectCount, setDefectCount] = useState<number>(0);

  // NOVO: Polling para buscar a contagem de defeitos da câmera em tempo real
  useEffect(() => {
    if (analysisType !== "tecido") return;

    const fetchDefects = async () => {
      try {
        const response = await fetch(`${CAMERA_API_URL}/defect-count`);
        if (response.ok) {
          const data = await response.json();
          setDefectCount(data.count);
        }
      } catch {
        // Ignora erro silenciosamente
      }
    };

    fetchDefects(); // Busca imediatamente
    const intervalId = setInterval(fetchDefects, 1000); // A cada 1 segundo

    return () => clearInterval(intervalId);
  }, [analysisType]);

  // NOVO: Função para zerar as falhas
  const handleResetDefects = async () => {
    try {
      const response = await fetch(`${CAMERA_API_URL}/reset-count`, { method: "POST" });
      if (response.ok) {
        setDefectCount(0);
        toast.success("Contagem de falhas zerada.");
      }
    } catch {
      toast.error("Erro ao zerar contagem da câmera.");
    }
  };

  // Monta a URL dinâmica passando os percentuais para a API do Python
  const cameraStreamPath = analysisType === "tecido" 
  ? `/stream-analyzed.mjpg?w=${captureAreaWidth}&h=${captureAreaHeight}&estampado=${config.estampado}`
  : `/stream.mjpg`;

  return (
    // ... Renderiza a CameraPreview, passa a stream url
    // Exibe badges na UI e botoes para zerar...
  );
};

export default ColorAnalysis;
```
