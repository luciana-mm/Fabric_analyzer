import pytest
from fastapi.testclient import TestClient


class TestApiEndpoints:
    def test_health_endpoint(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        assert "active_camera" in data

    def test_get_and_update_detector_config(self, client: TestClient):
        # 1. GET
        res_get = client.get("/detector-config")
        assert res_get.status_code == 200
        initial_cfg = res_get.json()
        assert "w" in initial_cfg
        assert "h" in initial_cfg

        # 2. POST update
        updated_payload = dict(initial_cfg)
        updated_payload["w"] = 75
        updated_payload["h"] = 45
        updated_payload["linha_orientacao"] = "horizontal"

        res_post = client.post("/detector-config", json=updated_payload)
        assert res_post.status_code == 200
        saved_cfg = res_post.json()
        assert saved_cfg["w"] == 75
        assert saved_cfg["h"] == 45
        assert saved_cfg["linha_orientacao"] == "horizontal"

    def test_detector_mode_switching(self, client: TestClient):
        # 1. Altera para anomalib
        res_anom = client.post("/detector-mode", json={"mode": "anomalib"})
        assert res_anom.status_code == 200
        assert res_anom.json()["mode"] == "anomalib"
        assert res_anom.json()["estampado"] is True

        # 2. Consulta modo ativo
        res_get = client.get("/detector-mode")
        assert res_get.status_code == 200
        assert res_get.json()["mode"] == "anomalib"

        # 3. Retorna para classic
        res_classic = client.post("/detector-mode", json={"mode": "classic"})
        assert res_classic.status_code == 200
        assert res_classic.json()["mode"] == "classic"
        assert res_classic.json()["estampado"] is False

        # 4. Modo inválido deve retornar 400
        res_invalid = client.post("/detector-mode", json={"mode": "modo_inexistente"})
        assert res_invalid.status_code == 400

    def test_defect_count_and_reset(self, client: TestClient):
        # GET defect count
        res_count = client.get("/defect-count")
        assert res_count.status_code == 200
        assert "count" in res_count.json()

        # POST reset count
        res_reset = client.post("/reset-count")
        assert res_reset.status_code == 200
        assert res_reset.json()["success"] is True
        assert res_reset.json()["count"] == 0

    def test_reference_color_and_palette(self, client: TestClient):
        # 1. Salva cor única de referência
        res_color = client.post("/reference-color", json={"r": 180, "g": 120, "b": 70})
        assert res_color.status_code == 200
        assert "ref_a" in res_color.json()
        assert "ref_b" in res_color.json()

        # 2. Salva paleta multicor
        palette_payload = {
            "samples": [
                {"r": 180, "g": 120, "b": 70},
                {"r": 190, "g": 130, "b": 80},
                {"r": 170, "g": 110, "b": 60},
            ]
        }
        res_pal = client.post("/reference-palette", json=palette_payload)
        assert res_pal.status_code == 200
        data_pal = res_pal.json()
        assert "paleta" in data_pal
        assert len(data_pal["paleta"]) >= 1

        # 3. GET paleta
        res_get_pal = client.get("/reference-palette")
        assert res_get_pal.status_code == 200
        assert "paleta" in res_get_pal.json()

    def test_dvr_mock_endpoints(self, client: TestClient):
        mock_payload = {
            "name": "Simulador CFTV Test",
            "brand": "mock",
            "host": "127.0.0.1",
            "total_channels": 2,
        }

        # 1. Test connection
        res_conn = client.post("/dvr/test-connection", json=mock_payload)
        assert res_conn.status_code == 200
        assert res_conn.json()["success"] is True

        # 2. Discover cameras
        res_disc = client.post("/dvr/discover", json=mock_payload)
        assert res_disc.status_code == 200
        cameras = res_disc.json()["cameras"]
        assert len(cameras) == 2

        # 3. Snapshot simulado
        res_snap = client.get("/dvr/mock/snapshot?channel=1")
        assert res_snap.status_code == 200
        assert res_snap.headers["content-type"] == "image/jpeg"
        assert res_snap.content[:2] == b"\xff\xd8"

        # 4. Monitor status
        res_mon = client.get("/dvr/monitor/status")
        assert res_mon.status_code == 200

        # 5. Active camera
        res_active = client.post(
            "/dvr/active-camera",
            json={
                "cameraId": "mock-ch-1",
                "cameraName": "Simulador 01",
                "channel": "1",
                "brand": "mock",
                "host": "127.0.0.1",
            },
        )
        assert res_active.status_code == 200
        assert res_active.json()["activeCamera"]["brand"] == "mock"

        # 6. GET active camera
        res_get_active = client.get("/dvr/active-camera")
        assert res_get_active.status_code == 200
        assert res_get_active.json()["brand"] == "mock"
