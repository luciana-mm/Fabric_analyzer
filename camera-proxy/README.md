# Camera Proxy & Motor Híbrido de Visão Computacional (OpenCV + Anomalib)

Este serviço em Python (FastAPI) conecta na câmera Hikvision via RTSP, processa os frames em tempo real (`12 FPS`) e disponibiliza o stream analisado e as rotas de calibração para o frontend.

## Arquitetura de Detecção (`detector.py` + `anomalib_detector.py`)

1. **Tecidos Lisos (`estampado = false`) — `ColorDetector` (OpenCV Clássico):**
   - Opera no espaço perceptual CIE L\*a\*b\* com normalização de iluminação local (`medianBlur 41x41`) e filtragem morfológica.
   - Referência salva em: `camera-proxy/calibrated-color-reference.json`.
2. **Tecidos Detalhados / Estampados (`estampado = true`) — `AnomalibDetector` (PatchCore / ResNet18):**
   - Aprendizado Não-Supervisionado (*One-Class*): aprende o padrão da estampa usando **apenas fotos do tecido BOM** capturadas antes da análise (`POST /calibrate-pattern`).
   - Fotos do tecido bom salvas em: `camera-proxy/reference_patterns/active_pattern/frames/`.
   - Banco de memória salvo em: `camera-proxy/reference_patterns/active_pattern/memory_bank.npz`.
   - Backbone local: `camera-proxy/models/resnet18_backbone.pth`.

## Endpoints Principais

- `GET /stream.mjpg` — Stream bruto da câmera
- `GET /stream-analyzed.mjpg` — Stream com ROI, linha de contagem e detecções em tempo real
- `POST /reference-palette` — Calibra a paleta de cor (OpenCV)
- `POST /calibrate-pattern` — Captura fotos do tecido bom e constrói o Memory Bank da estampa (Anomalib)
- `GET /pattern-status` — Retorna status e metadados da estampa calibrada no Anomalib
- `GET /defect-count` / `POST /reset-count` — Leitura e reset do contador de defeitos (`DefectTracker`)
- `GET /health` — Status de conexão com a câmera RTSP