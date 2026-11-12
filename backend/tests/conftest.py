import os
import sys
from pathlib import Path
from typing import Generator
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

# Adiciona o diretório do backend ao sys.path para importações absolutas e relativas
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import runtime_state as rt
from server import app


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    """Cliente HTTP de teste para os endpoints do FastAPI."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def synthetic_clean_frame() -> np.ndarray:
    """Gera um frame sintético uniforme de tecido (640x480) sem nenhum defeito."""
    # Tecido azul/esverdeado uniforme
    frame = np.full((480, 640, 3), [160, 120, 70], dtype=np.uint8)
    # Adiciona leve ruído gaussiano para simular textura têxtil real
    noise = np.random.normal(0, 2, frame.shape).astype(np.int16)
    noisy_frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return noisy_frame


@pytest.fixture
def synthetic_defective_frame(synthetic_clean_frame: np.ndarray) -> np.ndarray:
    """Gera um frame sintético de tecido com um defeito (mancha/furo contrastante)."""
    frame = synthetic_clean_frame.copy()
    # Adiciona um defeito circular escuro / contrastante no centro
    cv2.circle(frame, (320, 240), 25, (10, 10, 220), -1)
    return frame


@pytest.fixture(autouse=True)
def reset_runtime(monkeypatch):
    """Restaura o estado do tracker e detector e previne timeouts de banco de dados offline."""
    import db
    monkeypatch.setattr(db, "get_db_connection", lambda *a, **kw: None)
    rt.global_tracker.reset()
    yield
    rt.global_tracker.reset()
