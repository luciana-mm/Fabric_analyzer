#!/usr/bin/env python3
"""
train.py  (colocar em camera-proxy/)

Treina o YOLO com o dataset em ../dataset e copia o melhor modelo
para camera-proxy/models/best.pt (que o server.py carrega sozinho).

Uso (de dentro de camera-proxy/):
    python train.py
    python train.py --epochs 150 --batch 8
"""

import argparse
import shutil
import sys
from pathlib import Path

import yaml
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = (BASE_DIR.parent / "dataset").resolve()
MODELS_DIR = BASE_DIR / "models"
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}


def contar(pasta: Path) -> int:
    if not pasta.exists():
        return 0
    return sum(1 for f in pasta.iterdir() if f.suffix.lower() in IMG_EXTS)


def main():
    parser = argparse.ArgumentParser(description="Treino do YOLO para defeitos em tecido.")
    parser.add_argument("--base-model", default=str(MODELS_DIR / "yolov8n.pt"))
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default=None, help="ex: 0 (GPU) ou cpu. Padrão: automático")
    parser.add_argument("--patience", type=int, default=30)
    args = parser.parse_args()

    data_yaml = DATASET_DIR / "data.yaml"
    if not data_yaml.exists():
        sys.exit(
            f"data.yaml não encontrado em {data_yaml}.\n"
            "Rode antes: python ../dataset/generate_data_yaml.py"
        )

    n_train = contar(DATASET_DIR / "images" / "train")
    n_val = contar(DATASET_DIR / "images" / "val")
    print(f"Imagens de treino: {n_train} | validação: {n_val}")
    if n_train < 10 or n_val < 2:
        sys.exit("Poucas imagens. Anote e rode o split_dataset.py antes de treinar.")

    # O data.yaml tem 'path: .', que depende de onde o comando roda.
    # Gravamos uma cópia com o caminho absoluto para funcionar de qualquer pasta.
    cfg = yaml.safe_load(data_yaml.read_text(encoding="utf-8"))
    cfg["path"] = DATASET_DIR.as_posix()
    resolved = DATASET_DIR / "data_resolved.yaml"
    resolved.write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False), encoding="utf-8")

    base = args.base_model if Path(args.base_model).exists() else "yolov8n.pt"
    print(f"Modelo base: {base}")
    model = YOLO(base)

    model.train(
        data=str(resolved),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        patience=args.patience,
        project=str(BASE_DIR / "runs"),
        name="tecido",
        exist_ok=True,
        # Tecido na esteira: sem flip vertical e sem mudar muito a cor
        # (a cor é justamente um dos defeitos: "tonalidade").
        flipud=0.0,
        fliplr=0.5,
        hsv_h=0.005,
        hsv_s=0.3,
        hsv_v=0.3,
    )

    best = BASE_DIR / "runs" / "tecido" / "weights" / "best.pt"
    if not best.exists():
        sys.exit(f"Treino terminou mas {best} não foi encontrado.")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    destino = MODELS_DIR / "best.pt"
    shutil.copy2(best, destino)
    print(f"\nModelo copiado para: {destino}")
    print("Reinicie o servidor (uvicorn server:app) ou chame POST /detector-mode com {\"mode\": \"yolo\"}.")


if __name__ == "__main__":
    main()