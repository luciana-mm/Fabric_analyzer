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
