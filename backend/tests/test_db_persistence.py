from unittest.mock import MagicMock
import pytest
import db


class TestDbPersistence:
    @pytest.fixture(autouse=True)
    def fast_mock_connection(self, monkeypatch):
        """Simula banco indisponível por padrão para testes rápidos de fallback em memória."""
        monkeypatch.setattr(db, "get_db_connection", lambda *a, **kw: None)

    def test_runtime_setting_default_fallback(self):
        val = db.get_runtime_setting("chave_inexistente_de_teste_123", default={"sensibilidade": 50})
        assert val == {"sensibilidade": 50}

    def test_set_and_get_runtime_setting(self):
        key = "test_detector_thresholds"
        data = {"threshold": 0.85, "model": "test_patchcore"}
        db.set_runtime_setting(key, data)

        fetched = db.get_runtime_setting(key)
        assert fetched is not None
        assert fetched["threshold"] == 0.85
        assert fetched["model"] == "test_patchcore"

    def test_set_runtime_setting_merge_dictionary(self):
        key = "test_config_merge"
        # 1. Valor inicial
        db.set_runtime_setting(key, {"a": 1, "b": 2})
        # 2. Merge parcial em memória
        db.set_runtime_setting(key, {"b": 99, "c": 3}, merge=True)

        fetched = db.get_runtime_setting(key)
        assert fetched is not None
        assert fetched["a"] == 1
        assert fetched["b"] == 99
        assert fetched["c"] == 3

    def test_operator_active_camera_persistence(self):
        db.set_operator_active_camera(
            camera_id="cam-lin-01",
            camera_name="Camera Linha 1",
            brand="hikvision",
            stream_url="rtsp://admin:pwd@10.0.0.10:554/Streaming/Channels/101",
            channel="1",
        )

        active = db.get_runtime_setting("active_operator_camera")
        assert active is not None
        assert active["camera_id"] == "cam-lin-01"
        assert active["camera_name"] == "Camera Linha 1"
        assert active["brand"] == "hikvision"
        assert active["channel"] == "1"

    def test_mock_db_sql_execution(self, monkeypatch):
        """Testa o caminho de execução SQL quando uma conexão válida com Postgres está disponível."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {"value": {"sensibilidade": 35}}
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        monkeypatch.setattr(db, "get_db_connection", lambda *a, **kw: mock_conn)
        monkeypatch.setattr(db, "ensure_runtime_table_exists", lambda conn: None)

        # Teste de leitura com conexão ativa
        val = db.get_runtime_setting("teste_sql_key")
        assert val == {"sensibilidade": 35}
        mock_cursor.execute.assert_called_once()
