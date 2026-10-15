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
