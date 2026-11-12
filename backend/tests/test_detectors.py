import cv2
import numpy as np
import pytest

from detector import BaseDetector, ColorDetector, Detection, DefectTracker
from anomalib_detector import AnomalibDetector


class TestColorDetector:
    def test_detector_initialization(self):
        detector = ColorDetector(limiar_cor_ab=9.0, area_min_pequena=15)
        assert detector.mode_name == "classic"
        assert detector.limiar_cor_ab == 9.0
        assert detector.area_min_pequena == 15
        assert isinstance(detector, BaseDetector)

    def test_clean_frame_yields_zero_defects(self, synthetic_clean_frame: np.ndarray):
        lab = cv2.cvtColor(synthetic_clean_frame, cv2.COLOR_BGR2LAB)
        ref_a = int(np.mean(lab[:, :, 1]))
        ref_b = int(np.mean(lab[:, :, 2]))

        detector = ColorDetector(
            limiar_cor_ab=12.0,
            area_min_pequena=30,
        )
        config = {
            "ref_a": ref_a,
            "ref_b": ref_b,
            "limiar_cor_ab": 12.0,
            "area_min_pequena": 30,
        }

        detections = detector.detect(synthetic_clean_frame, config)
        assert len(detections) == 0
        assert detector.last_inference_ms >= 0.0

    def test_defective_frame_detects_defect(
        self, synthetic_clean_frame: np.ndarray, synthetic_defective_frame: np.ndarray
    ):
        lab = cv2.cvtColor(synthetic_clean_frame, cv2.COLOR_BGR2LAB)
        ref_a = int(np.mean(lab[:, :, 1]))
        ref_b = int(np.mean(lab[:, :, 2]))

        detector = ColorDetector(limiar_cor_ab=10.0, area_min_pequena=20)
        config = {
            "ref_a": ref_a,
            "ref_b": ref_b,
            "limiar_cor_ab": 10.0,
            "area_min_pequena": 20,
            "distancia_max_fusao": 40,
        }

        detections = detector.detect(synthetic_defective_frame, config)
        assert len(detections) >= 1

        # Verifica se o defeito detectado está próximo ao centro (320, 240)
        found_near_center = False
        for det in detections:
            cx, cy = det.centroid
            if abs(cx - 320) < 60 and abs(cy - 240) < 60:
                found_near_center = True
                assert det.area > 20
                assert det.label in ("mancha", "tonalidade", "furo", "fio_puxado")
                assert det.confidence is not None and 0.5 <= det.confidence <= 1.0
                break
        assert found_near_center, "O defeito injetado no centro não foi localizado pelo detector."

    def test_multi_color_palette(self, synthetic_clean_frame: np.ndarray):
        lab = cv2.cvtColor(synthetic_clean_frame, cv2.COLOR_BGR2LAB)
        ref_a = int(np.mean(lab[:, :, 1]))
        ref_b = int(np.mean(lab[:, :, 2]))

        detector = ColorDetector(limiar_cor_ab=12.0)
        config = {
            "paleta": [[ref_a, ref_b], [ref_a + 25, ref_b - 25]],
            "limiar_cor_ab": 12.0,
        }

        detections = detector.detect(synthetic_clean_frame, config)
        assert len(detections) == 0

    def test_status_reporting(self):
        detector = ColorDetector()
        status = detector.get_status()
        assert status["mode"] == "classic"
        assert status["calibrated"] is True
        assert "last_inference_ms" in status


class TestAnomalibDetector:
    def test_initialization_and_interface(self, tmp_path):
        pattern_dir = tmp_path / "test_pattern"
        detector = AnomalibDetector(pattern_dir=pattern_dir)
        assert detector.mode_name == "anomalib"
        assert isinstance(detector, BaseDetector)
        assert detector.is_calibrated is False

    def test_uncalibrated_detect_returns_empty(self, synthetic_clean_frame: np.ndarray, tmp_path):
        pattern_dir = tmp_path / "test_pattern"
        detector = AnomalibDetector(pattern_dir=pattern_dir)
        detections = detector.detect(synthetic_clean_frame, {})
        assert detections == []
        assert detector.last_inference_ms == 0.0

    def test_status_reporting(self, tmp_path):
        pattern_dir = tmp_path / "test_pattern"
        detector = AnomalibDetector(pattern_dir=pattern_dir)
        status = detector.get_status()
        assert status["calibrated"] is False
        assert "frames_dir" in status
        assert "metadata" in status


class TestDefectTracker:
    def test_tracker_tracks_and_counts_defects(self):
        tracker = DefectTracker(
            linha_orientacao="vertical",
            frames_max_sumico=5,
            frames_min_confirmacao=2,
            distancia_max_rastreio=50,
        )
        linha_pos = 300

        # Frame 1: Objeto no lado esquerdo (x=270, y=200)
        det1 = Detection(box=(260, 190, 280, 210), centroid=(270, 200), area=400)
        tracker.update([det1], linha_pos)
        assert tracker.get_count() == 0

        # Frame 2: Mesmo objeto permanece no lado esquerdo confirmando presença (x=280, y=200)
        det2 = Detection(box=(270, 190, 290, 210), centroid=(280, 200), area=400)
        tracker.update([det2], linha_pos)
        assert tracker.get_count() == 0

        # Frame 3: Objeto cruza a linha para o lado direito (x=320, y=200)
        det3 = Detection(box=(310, 190, 330, 210), centroid=(320, 200), area=400)
        tracker.update([det3], linha_pos)
        # Deve ter contado 1 cruzamento
        assert tracker.get_count() == 1

        # Frame 4: Objeto continua no lado direito (x=340, y=200)
        det4 = Detection(box=(330, 190, 350, 210), centroid=(340, 200), area=400)
        tracker.update([det4], linha_pos)
        # Não deve duplicar a contagem
        assert tracker.get_count() == 1

    def test_tracker_reset(self):
        tracker = DefectTracker()
        det = Detection(box=(100, 100, 120, 120), centroid=(110, 110), area=400)
        tracker.update([det], 200)
        assert len(tracker.objetos) == 1

        tracker.reset()
        assert tracker.get_count() == 0
        assert len(tracker.objetos) == 0
        assert tracker.next_id == 0

    def test_horizontal_line_tracking(self):
        tracker = DefectTracker(linha_orientacao="horizontal", frames_min_confirmacao=2)
        linha_pos = 200

        # Acima da linha (y=180)
        det1 = Detection(box=(100, 170, 120, 190), centroid=(110, 180), area=400)
        tracker.update([det1], linha_pos)
        tracker.update([det1], linha_pos)
        assert tracker.get_count() == 0

        # Abaixo da linha (y=220)
        det2 = Detection(box=(100, 210, 120, 230), centroid=(110, 220), area=400)
        tracker.update([det2], linha_pos)
        assert tracker.get_count() == 1
