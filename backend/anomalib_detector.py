"""
anomalib_detector.py

Motor de Detecção de Anomalias Não-Supervisionado (estilo Anomalib PatchCore / PaDiM)
para inspeção de tecidos detalhados e estampados.

Como funciona:
1. Calibração (Apenas Tecido Bom):
   - Antes de iniciar a análise, o sistema captura N fotos (ex: 20 frames) da Área de
     Análise (ROI) contendo apenas o tecido BOM (sem defeitos).
   - As fotos reais são salvas em `camera-proxy/reference_patterns/active_pattern/frames/`.
   - Os frames passam pelas camadas intermediárias (layer1 + layer2) de uma ResNet18
     pré-treinada combinadas com descritores cromáticos CIE L*a*b*, gerando um
     Banco de Memória Coreset (Memory Bank) dos retalhos (patches) normais da estampa.
   - O banco de memória é salvo em `memory_bank.npz` e os metadados em `metadata.json`.

2. Inferência em Tempo Real (12 FPS):
   - Cada novo frame da câmera (ROI) tem seus patches extraídos e comparados via
     distância de vizinho mais próximo (k-NN no espaço de features) contra o Memory Bank.
   - Regiões que fogem do padrão aprendido da estampa geram valores altos no Mapa de
     Calor de Anomalia (Anomaly Map), que é segmentado em caixas `Detection` para o
     `DefectTracker`.
"""

import json
import logging
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models

from detector import BaseDetector, Detection

_log = logging.getLogger("camera-proxy.anomalib")

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DEFAULT_BACKBONE_PATH = MODELS_DIR / "resnet18_backbone.pth"
DEFAULT_PATTERN_DIR = BASE_DIR / "reference_patterns" / "active_pattern"


class _ResNetFeatureExtractor(nn.Module):
    """
    Extrai mapas de características multi-escala (layer1 e layer2) de uma ResNet18.
    Usamos layer1 e layer2 porque preservam alta resolução espacial (essencial para
    furos pequenos e fios puxados) ao mesmo tempo em que capturam a textura da estampa.
    """

    def __init__(self, weights_path: Path = DEFAULT_BACKBONE_PATH) -> None:
        super().__init__()
        backbone = models.resnet18(weights=None)
        if weights_path.exists():
            state_dict = torch.load(str(weights_path), map_location="cpu", weights_only=True)
            backbone.load_state_dict(state_dict)
            _log.info("Backbone ResNet18 carregado localmente de: %s", weights_path)
        else:
            _log.warning(
                "Arquivo %s não encontrado; tentando carregar ResNet18 padrão do torchvision.",
                weights_path,
            )
            backbone = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)

        self.stem = nn.Sequential(
            backbone.conv1,
            backbone.bn1,
            backbone.relu,
            backbone.maxpool,
        )
        self.layer1 = backbone.layer1  # 64 canais, resolução H/4 x W/4
        self.layer2 = backbone.layer2  # 128 canais, resolução H/8 x W/8

        for param in self.parameters():
            param.requires_grad = False
        self.eval()

    @torch.no_grad()
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.stem(x)
        feat1 = self.layer1(x)       # (B, 64, H/4, W/4) -> alta nitidez espacial para defeitos pequenos
        feat2 = self.layer2(feat1)   # (B, 128, H/8, W/8) -> contexto semântico da estampa

        # Mantemos layer1 sem blur 3x3 para não diluir manchas/furos pequenos em fundos claros,
        # e suavizamos apenas layer2 para estabilidade estrutural da estampa.
        target_h, target_w = feat2.shape[2], feat2.shape[3]
        feat1_down = F.adaptive_avg_pool2d(feat1, (target_h, target_w))
        feat2_smooth = F.avg_pool2d(feat2, kernel_size=3, stride=1, padding=1)

        combined = torch.cat([feat1_down, feat2_smooth], dim=1)  # (B, 192, H_grid, W_grid)
        return combined


class AnomalibDetector(BaseDetector):
    """
    Detector de anomalias baseado em PatchCore (Anomalib architecture) para tecidos estampados.
    """

    INPUT_SIZE = (256, 256)        # Resolução padronizada para extração rápida (~32x32 = 1024 patches)
    MAX_CORESET_PATCHES = 2048     # Tamanho máximo do banco de memória para manter >12 FPS em CPU
    EMBEDDING_DIM = 201            # 192 canais CNN (ResNet18) + 9 canais CIE L*a*b* (mean, max, min)

    def __init__(
        self,
        backbone_path: Optional[str] = None,
        pattern_dir: Optional[str] = None,
        device: Optional[str] = None,
    ) -> None:
        self.device = torch.device(
            device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self.backbone_path = Path(backbone_path) if backbone_path else DEFAULT_BACKBONE_PATH
        self.pattern_dir = Path(pattern_dir) if pattern_dir else DEFAULT_PATTERN_DIR
        self.frames_dir = self.pattern_dir / "frames"
        self.memory_bank_path = self.pattern_dir / "memory_bank.npz"
        self.metadata_path = self.pattern_dir / "metadata.json"

        self._lock = threading.Lock()
        self.extractor = _ResNetFeatureExtractor(self.backbone_path).to(self.device)

        # Normalização padrão ImageNet
        self.mean = torch.tensor([0.485, 0.456, 0.406], device=self.device).view(1, 3, 1, 1)
        self.std = torch.tensor([0.229, 0.224, 0.225], device=self.device).view(1, 3, 1, 1)
        # Pesos cromáticos CIE L*a*b*: L*=1.0 (tolerante a pequenas variações de sombra) e a*,b*=2.8 (alta sensibilidade a manchas)
        self.lab_weights = torch.tensor([1.0, 2.8, 2.8], device=self.device).view(1, 3, 1, 1)

        # Estado do banco de memória aprendido
        self.memory_bank: Optional[torch.Tensor] = None
        self.threshold: float = 0.56
        self.mean_dist: float = 0.24
        self.std_dist: float = 0.08
        self.metadata: dict = {}

        # Tenta carregar um padrão já calibrado em disco ao iniciar
        self.load_pattern()

    @property
    def is_calibrated(self) -> bool:
        return self.memory_bank is not None and self.memory_bank.shape[0] > 0

    def _extract_patch_embeddings(self, bgr_images: List[np.ndarray]) -> tuple[torch.Tensor, int, int]:
        """
        Converte uma lista de imagens BGR em embeddings de patches:
        Retorna (embeddings [N, H_grid * W_grid, D], H_grid, W_grid).
        Combina features profundas da ResNet18 (192 canais) com estatísticas locais
        CIE L*a*b* (média, máximo e mínimo dentro de cada patch = 9 canais) para que
        mesmo manchas pequenas sobre partes claras ou escuras da estampa se destaquem.
        """
        rgb_tensors = []
        lab_tensors = []

        target_w, target_h = self.INPUT_SIZE
        for img in bgr_images:
            resized = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_AREA)
            rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB).astype(np.float32) / 255.0

            rgb_tensors.append(torch.from_numpy(rgb).permute(2, 0, 1))
            lab_tensors.append(torch.from_numpy(lab).permute(2, 0, 1))

        batch_rgb = torch.stack(rgb_tensors, dim=0).to(self.device)
        batch_rgb = (batch_rgb - self.mean) / self.std

        batch_lab = torch.stack(lab_tensors, dim=0).to(self.device)

        with torch.no_grad():
            cnn_feats = self.extractor(batch_rgb)  # (B, 192, H_grid, W_grid)
            cnn_feats = F.normalize(cnn_feats, p=2, dim=1)

            h_grid, w_grid = cnn_feats.shape[2], cnn_feats.shape[3]

            # Estatísticas locais por patch (média, pico máximo e pico mínimo de cor LAB)
            # Isso impede que uma mancha pequena seja diluída pela média dos pixels vizinhos!
            lab_mean = F.adaptive_avg_pool2d(batch_lab, (h_grid, w_grid))
            lab_max = F.adaptive_max_pool2d(batch_lab, (h_grid, w_grid))
            lab_min = -F.adaptive_max_pool2d(-batch_lab, (h_grid, w_grid))

            lab_feats = torch.cat(
                [
                    (lab_mean - 0.5) * self.lab_weights,
                    (lab_max - 0.5) * self.lab_weights,
                    (lab_min - 0.5) * self.lab_weights,
                ],
                dim=1,
            )  # (B, 9, H_grid, W_grid)

            combined = torch.cat([cnn_feats, lab_feats], dim=1)  # (B, 201, H_grid, W_grid)
            b, c, h, w = combined.shape
            patches = combined.permute(0, 2, 3, 1).reshape(b, h * w, c)

        return patches, h_grid, w_grid

    def fit_from_frames(self, frames: List[np.ndarray], save_dir: Optional[Path] = None) -> dict:
        """
        Recebe uma lista de frames do tecido BOM (sem defeito), salva as fotos em disco
        e constrói o Memory Bank de referência da estampa.
        """
        if not frames:
            raise ValueError("Nenhum frame fornecido para calibração do padrão no Anomalib.")

        target_dir = Path(save_dir) if save_dir else self.pattern_dir
        frames_dir = target_dir / "frames"
        memory_bank_path = target_dir / "memory_bank.npz"
        metadata_path = target_dir / "metadata.json"

        # 1. Limpa fotos antigas e salva as novas fotos do tecido bom
        if frames_dir.exists():
            shutil.rmtree(frames_dir)
        frames_dir.mkdir(parents=True, exist_ok=True)

        saved_files = []
        valid_frames = []
        for idx, frame in enumerate(frames, start=1):
            if frame is None or frame.size == 0:
                continue
            filename = f"good_{idx:03d}.jpg"
            filepath = frames_dir / filename
            cv2.imwrite(str(filepath), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
            saved_files.append(filename)
            valid_frames.append(frame)

        if not valid_frames:
            raise ValueError("Nenhum frame válido pôde ser salvo para calibração.")

        # 2. Extrai embeddings de todos os frames bons
        patches_per_img, h_grid, w_grid = self._extract_patch_embeddings(valid_frames)
        # patches_per_img: (N_imgs, N_patches, D)
        n_imgs, n_patches, dim = patches_per_img.shape
        all_patches = patches_per_img.reshape(n_imgs * n_patches, dim)

        # 3. Subamostragem Coreset (mantém os patches mais diversos + amostragem uniforme)
        total_patches = all_patches.shape[0]
        if total_patches > self.MAX_CORESET_PATCHES:
            generator = torch.Generator(device=self.device)
            generator.manual_seed(42)
            perm = torch.randperm(total_patches, generator=generator, device=self.device)
            coreset = all_patches[perm[: self.MAX_CORESET_PATCHES]].contiguous()
        else:
            coreset = all_patches.contiguous()

        # 4. Calcula estatísticas de distância normal (usando k-NN entre frames bons e o coreset)
        with torch.no_grad():
            dists = torch.cdist(all_patches, coreset, p=2)  # (total_patches, coreset_size)
            # Pega o 3º vizinho mais próximo (evita distância zero do patch com ele mesmo)
            k = min(4, coreset.shape[0])
            topk_dists, _ = torch.topk(dists, k=k, dim=1, largest=False)
            nn_dists = topk_dists[:, -1].cpu().numpy()

        mean_dist = float(np.mean(nn_dists))
        std_dist = max(float(np.std(nn_dists)), 1e-3)
        p99_dist = float(np.percentile(nn_dists, 99.2))

        # Limiar adaptativo calibrado: mantém margem segura para movimentos da estampa
        # sem perder manchas pequenas em regiões claras ou escuras.
        adaptive_threshold = max(p99_dist * 1.32, mean_dist + 4.5 * std_dist, 0.38)

        metadata = {
            "calibrated_at": datetime.now(timezone.utc).isoformat(),
            "num_frames": len(valid_frames),
            "coreset_size": int(coreset.shape[0]),
            "embedding_dim": int(dim),
            "grid_size": [int(h_grid), int(w_grid)],
            "input_size": list(self.INPUT_SIZE),
            "mean_dist": round(mean_dist, 5),
            "std_dist": round(std_dist, 5),
            "p99_dist": round(p99_dist, 5),
            "threshold": round(adaptive_threshold, 5),
            "frames_dir": str(frames_dir),
            "saved_files": saved_files,
        }

        # 5. Salva o banco de memória e os metadados em disco
        np.savez_compressed(
            str(memory_bank_path),
            memory_bank=coreset.cpu().numpy().astype(np.float32),
            mean_dist=np.float32(mean_dist),
            std_dist=np.float32(std_dist),
            threshold=np.float32(adaptive_threshold),
        )
        metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")

        with self._lock:
            self.memory_bank = coreset
            self.mean_dist = mean_dist
            self.std_dist = std_dist
            self.threshold = adaptive_threshold
            self.metadata = metadata

        _log.info(
            "Anomalib calibrado com %d fotos boas | coreset=%d patches | threshold=%.4f",
            len(valid_frames),
            coreset.shape[0],
            adaptive_threshold,
        )
        return metadata

    def load_pattern(self, save_dir: Optional[Path] = None) -> bool:
        """Carrega o banco de memória salvo em disco, se existir."""
        target_dir = Path(save_dir) if save_dir else self.pattern_dir
        memory_bank_path = target_dir / "memory_bank.npz"
        metadata_path = target_dir / "metadata.json"
        frames_dir = target_dir / "frames"

        if not memory_bank_path.exists():
            return False

        try:
            data = np.load(str(memory_bank_path))
            bank_np = data["memory_bank"].astype(np.float32)

            # Se o banco salvo tiver dimensão antiga (ex: 195 canais antes do upgrade para 201),
            # recalibra automaticamente a partir das fotos salvas em frames/
            if bank_np.ndim != 2 or bank_np.shape[1] != self.EMBEDDING_DIM:
                if frames_dir.exists():
                    existing_imgs = [
                        cv2.imread(str(p))
                        for p in sorted(frames_dir.glob("good_*.jpg"))
                    ]
                    existing_imgs = [img for img in existing_imgs if img is not None]
                    if existing_imgs:
                        _log.info(
                            "Atualizando Memory Bank de %d para %d canais usando %d fotos salvas...",
                            bank_np.shape[1] if bank_np.ndim == 2 else 0,
                            self.EMBEDDING_DIM,
                            len(existing_imgs),
                        )
                        self.fit_from_frames(existing_imgs, save_dir=target_dir)
                        return True
                return False

            mean_dist = float(data["mean_dist"])
            std_dist = float(data["std_dist"])
            threshold = float(data["threshold"])

            meta = {}
            if metadata_path.exists():
                meta = json.loads(metadata_path.read_text(encoding="utf-8"))

            with self._lock:
                self.memory_bank = torch.from_numpy(bank_np).to(self.device)
                self.mean_dist = mean_dist
                self.std_dist = std_dist
                self.threshold = threshold
                self.metadata = meta

            _log.info(
                "Padrão Anomalib carregado do disco (%d patches, threshold=%.4f)",
                bank_np.shape[0],
                threshold,
            )
            return True
        except Exception as err:
            _log.warning("Não foi possível carregar padrão Anomalib de %s: %s", memory_bank_path, err)
            return False

    def clear_pattern(self) -> None:
        """Remove o padrão calibrado atual da memória e do disco."""
        with self._lock:
            self.memory_bank = None
            self.metadata = {}
        if self.pattern_dir.exists():
            shutil.rmtree(self.pattern_dir, ignore_errors=True)

    def get_status(self) -> dict:
        with self._lock:
            return {
                "calibrated": self.is_calibrated,
                "frames_dir": str(self.frames_dir),
                "metadata": self.metadata,
            }

    def detect(self, roi: np.ndarray, config: dict) -> List[Detection]:
        """
        Executa a detecção de anomalias no recorte (ROI) atual da câmera.
        Retorna List[Detection] compatível com DefectTracker e Visualizer.
        """
        if roi is None or roi.size == 0:
            return []

        with self._lock:
            if not self.is_calibrated or self.memory_bank is None:
                return []
            bank = self.memory_bank
            base_threshold = self.threshold

        # Permite ajuste fino opcional via config (ex: anomalib_threshold_mult = 0.90 deixa mais sensível)
        sensitivity_mult = float(config.get("anomalib_threshold_mult", 1.0))
        effective_threshold = base_threshold * sensitivity_mult

        roi_h, roi_w = roi.shape[:2]

        # 1. Extrai os patches da ROI atual
        patches, h_grid, w_grid = self._extract_patch_embeddings([roi])
        query_patches = patches[0]  # (H_grid * W_grid, D)

        # 2. Distância de cada patch da imagem atual para o patch normal mais próximo no Memory Bank
        with torch.no_grad():
            dists = torch.cdist(query_patches, bank, p=2)  # (N_patches, Coreset)
            min_dists, _ = torch.min(dists, dim=1)
            anomaly_grid = min_dists.reshape(h_grid, w_grid).cpu().numpy()

        # 3. Ignora a borda de 3 patches para evitar falsos positivos em quadrados cortados na borda da ROI
        if h_grid > 8 and w_grid > 8:
            anomaly_grid[:3, :] = 0.0
            anomaly_grid[-3:, :] = 0.0
            anomaly_grid[:, :3] = 0.0
            anomaly_grid[:, -3:] = 0.0

        # 4. Redimensiona o Mapa de Calor de Anomalia para o tamanho original da ROI
        raw_anomaly_map = cv2.resize(anomaly_grid, (roi_w, roi_h), interpolation=cv2.INTER_CUBIC)
        anomaly_map = cv2.GaussianBlur(raw_anomaly_map, (5, 5), 0)

        # 5. Gera máscara binária onde o score de anomalia supera o limiar da estampa
        binary_mask = np.where(anomaly_map >= effective_threshold, 255, 0).astype(np.uint8)

        # Limpeza morfológica (5x5) para eliminar tirinhas finas e pontinhos isolados de ruído
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        binary_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_OPEN, kernel_open, iterations=1)
        kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        binary_mask = cv2.dilate(binary_mask, kernel_dilate, iterations=1)

        # 6. Extrai contornos e converte em objetos Detection
        contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        area_min = float(config.get("area_min", 260))
        area_max = float(config.get("area_max", roi_w * roi_h * 0.45))

        detections: List[Detection] = []
        for cnt in contours:
            area = float(cv2.contourArea(cnt))
            if area < area_min or area > area_max:
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            # Ignora tirinhas muito finas de borda (ex: 25x6 px) que não são defeitos reais
            if w < 12 or h < 12:
                continue

            cx = int(x + w // 2)
            cy = int(y + h // 2)

            # Usa o pico do mapa para calcular a confiança
            region_scores = raw_anomaly_map[y : y + h, x : x + w]
            peak_score = float(np.max(region_scores)) if region_scores.size > 0 else effective_threshold
            confidence = min(
                0.99,
                max(0.50, 0.50 + (peak_score - effective_threshold) / max(effective_threshold * 0.65, 1e-3)),
            )

            # Descarta ruídos fracos (0.55 ~ 0.70) mantendo defeitos reais (~0.80 a 0.99)
            if confidence < 0.72:
                continue

            detections.append(
                Detection(
                    box=(int(x), int(y), int(x + w), int(y + h)),
                    centroid=(cx, cy),
                    area=area,
                    label="anomalia",
                    confidence=round(confidence, 3),
                )
            )

        return detections

