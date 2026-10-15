import threading
from pathlib import Path
from typing import List

import numpy as np
from ultralytics import YOLO

from detector import BaseDetector, Detection


class YoloDetector(BaseDetector):
    """
    Detector de defeitos baseado em YOLO.

    - Carrega o modelo treinado (models/best.pt).
    - Os nomes das classes vêm do próprio modelo (definidos no data.yaml do treino),
      então não dependem de lista fixa no código.
    - Recebe o frame (BGR) e devolve a lista de Detection.
    """

    def __init__(
        self,
        model_path: str = "models/best.pt",
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45,
        imgsz: int = 640,
        device: str | None = None,
    ):
        path = Path(model_path)
        if not path.exists():
            raise FileNotFoundError(
                f"Modelo YOLO não encontrado em '{model_path}'. "
                "Treine com train.py e copie o best.pt para essa pasta."
            )

        self.model_path = str(path)
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.imgsz = imgsz
        self.device = device
        self.model = YOLO(self.model_path)
        self.class_names = self.model.names  # dict {id: nome}
        self._lock = threading.Lock()  # garante uma inferência por vez

    def detect(self, frame: np.ndarray, config: dict) -> List[Detection]:
        conf = config.get("yolo_conf")
        conf = float(conf) if conf is not None else self.conf_threshold

        with self._lock:
            results = self.model.predict(
                frame,
                conf=conf,
                iou=self.iou_threshold,
                imgsz=self.imgsz,
                device=self.device,
                verbose=False,
            )

        if not results:
            return []

        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            return []

        coordinates = boxes.xyxy.cpu().numpy().astype(np.int32, copy=False)
        confs = boxes.conf.cpu().numpy()
        classes = boxes.cls.cpu().numpy().astype(np.int32, copy=False)

        detections: List[Detection] = []
        for (x0, y0, x1, y1), c_conf, cls_idx in zip(coordinates, confs, classes):
            label = self.class_names.get(int(cls_idx), str(int(cls_idx)))
            w = int(x1 - x0)
            h = int(y1 - y0)
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