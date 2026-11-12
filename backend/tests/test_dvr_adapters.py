import pytest
from dvr_types import (
    BaseDvrAdapter,
    CameraDescriptor,
    ConnectionResult,
    DvrBrand,
    DvrDeviceConfig,
    ImageCaptureResult,
)
from dvr_adapters.factory import DvrAdapterFactory
from dvr_adapters.mock_adapter import MockDvrAdapter
from dvr_adapters.generic_rtsp_adapter import GenericRtspAdapter
from dvr_adapters.hikvision_adapter import HikvisionDvrAdapter
from dvr_adapters.intelbras_adapter import IntelbrasDvrAdapter
from dvr_adapters.droidcam_adapter import DroidCamAdapter


class TestDvrAdapterFactory:
    def test_factory_creates_mock_adapter(self):
        cfg = DvrDeviceConfig(
            name="Mock Test",
            brand=DvrBrand.MOCK,
            host="127.0.0.1",
            total_channels=4,
        )
        adapter = DvrAdapterFactory.create(cfg)
        assert isinstance(adapter, MockDvrAdapter)

    def test_factory_creates_hikvision_adapter(self):
        cfg = DvrDeviceConfig(
            name="Hik Test",
            brand=DvrBrand.HIKVISION,
            host="192.168.1.100",
            total_channels=8,
        )
        adapter = DvrAdapterFactory.create(cfg)
        assert isinstance(adapter, HikvisionDvrAdapter)

    def test_factory_creates_intelbras_adapter(self):
        cfg = DvrDeviceConfig(
            name="Intelbras Test",
            brand=DvrBrand.INTELBRAS,
            host="192.168.1.101",
            total_channels=16,
        )
        adapter = DvrAdapterFactory.create(cfg)
        assert isinstance(adapter, IntelbrasDvrAdapter)

    def test_factory_creates_droidcam_adapter(self):
        cfg = DvrDeviceConfig(
            name="Droid Test",
            brand=DvrBrand.DROIDCAM,
            host="192.168.1.50",
            http_port=4747,
        )
        adapter = DvrAdapterFactory.create(cfg)
        assert isinstance(adapter, DroidCamAdapter)

    def test_factory_creates_generic_adapter_for_unknown_brand(self):
        cfg = DvrDeviceConfig(
            name="Generic Test",
            brand=DvrBrand.GENERIC,
            host="192.168.1.200",
        )
        adapter = DvrAdapterFactory.create(cfg)
        assert isinstance(adapter, GenericRtspAdapter)

    def test_factory_from_dict(self):
        data = {
            "name": "Dict Test",
            "brand": "mock",
            "host": "localhost",
            "total_channels": 2,
        }
        adapter = DvrAdapterFactory.from_dict(data)
        assert isinstance(adapter, MockDvrAdapter)


class TestMockDvrAdapter:
    @pytest.fixture
    def mock_adapter(self) -> MockDvrAdapter:
        cfg = DvrDeviceConfig(
            name="Simulador Industrial",
            brand=DvrBrand.MOCK,
            host="127.0.0.1",
            total_channels=3,
        )
        return MockDvrAdapter(cfg)

    def test_mock_connection(self, mock_adapter: MockDvrAdapter):
        result = mock_adapter.test_connection()
        assert isinstance(result, ConnectionResult)
        assert result.success is True
        assert result.status_code == 200
        assert result.latency_ms >= 0.0
        assert result.details is not None
        assert result.details["brand"] == "mock"

    def test_mock_discover_cameras(self, mock_adapter: MockDvrAdapter):
        cameras = mock_adapter.discover_cameras()
        assert len(cameras) == 3
        for idx, cam in enumerate(cameras, start=1):
            assert isinstance(cam, CameraDescriptor)
            assert cam.channel_number == idx
            assert cam.id == f"mock-ch-{idx}"
            assert cam.stream_url == f"mock://127.0.0.1/channels/{idx}/main"
            assert cam.online is True

    def test_mock_stream_url(self, mock_adapter: MockDvrAdapter):
        url_main = mock_adapter.get_camera_stream_url("2", subtype="main")
        assert url_main == "mock://127.0.0.1/channels/2/main"
        url_sub = mock_adapter.get_camera_stream_url("ch3", subtype="sub")
        assert url_sub == "mock://127.0.0.1/channels/3/sub"

    def test_mock_capture_snapshot(self, mock_adapter: MockDvrAdapter):
        snapshot = mock_adapter.capture_snapshot("1")
        assert isinstance(snapshot, ImageCaptureResult)
        assert snapshot.mime_type == "image/jpeg"
        assert len(snapshot.buffer) > 0
        # Checa cabeçalho mágico JPEG 0xFF 0xD8
        assert snapshot.buffer[:2] == b"\xff\xd8"
        assert snapshot.width > 0
        assert snapshot.height > 0

    def test_mock_device_status(self, mock_adapter: MockDvrAdapter):
        status = mock_adapter.get_device_status()
        assert status["online"] is True
        assert status["brand"] == "mock"
        assert status["activeChannels"] == 3


class TestManufacturerStreamUrls:
    def test_hikvision_url_building(self):
        cfg = DvrDeviceConfig(
            name="Hik Test",
            brand=DvrBrand.HIKVISION,
            host="10.0.0.10",
            rtsp_port=554,
            username="admin",
            password="secretpassword",
        )
        adapter = HikvisionDvrAdapter(cfg)
        url = adapter.get_camera_stream_url("1", subtype="main")
        raw_url = adapter._build_raw_rtsp_url("1", subtype="main")
        # Canal 1 main no Hikvision é 101
        assert "rtsp://" in url
        assert "admin:****@10.0.0.10:554" in url
        assert "/Streaming/Channels/101" in url
        # URL raw interna para o worker deve conter as credenciais reais
        assert "admin:secretpassword@10.0.0.10:554" in raw_url

    def test_intelbras_url_building(self):
        cfg = DvrDeviceConfig(
            name="Intelbras Test",
            brand=DvrBrand.INTELBRAS,
            host="10.0.0.20",
            rtsp_port=554,
            username="admin",
            password="pwd",
        )
        adapter = IntelbrasDvrAdapter(cfg)
        url = adapter.get_camera_stream_url("2", subtype="sub")
        assert "rtsp://" in url
        assert "channel=2" in url
        assert "subtype=1" in url

    def test_droidcam_url_building(self):
        cfg = DvrDeviceConfig(
            name="DroidCam",
            brand=DvrBrand.DROIDCAM,
            host="192.168.1.15",
            http_port=4747,
        )
        adapter = DroidCamAdapter(cfg)
        url = adapter.get_camera_stream_url("1")
        assert url == "http://192.168.1.15:4747/video"
