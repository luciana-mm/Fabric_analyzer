from dvr_types import BaseDvrAdapter, DvrBrand, DvrDeviceConfig
from .droidcam_adapter import DroidCamAdapter
from .generic_rtsp_adapter import GenericRtspAdapter
from .hikvision_adapter import HikvisionDvrAdapter
from .intelbras_adapter import IntelbrasDvrAdapter
from .mock_adapter import MockDvrAdapter
from .onvif_adapter import GenericOnvifAdapter


class DvrAdapterFactory:
    """
    Factory responsável por instanciar o adaptador de DVR/Câmera correto
    com base no fabricante configurado (`DvrBrand`).
    """

    @staticmethod
    def create(config: DvrDeviceConfig) -> BaseDvrAdapter:
        brand = config.brand
        if isinstance(brand, str):
            try:
                brand = DvrBrand(brand.lower().strip())
            except ValueError:
                brand = DvrBrand.GENERIC

        if brand == DvrBrand.HIKVISION:
            return HikvisionDvrAdapter(config)
        if brand in (DvrBrand.INTELBRAS, DvrBrand.DAHUA):
            return IntelbrasDvrAdapter(config)
        if brand == DvrBrand.ONVIF:
            return GenericOnvifAdapter(config)
        if brand == DvrBrand.DROIDCAM:
            return DroidCamAdapter(config)
        if brand == DvrBrand.MOCK:
            return MockDvrAdapter(config)
        return GenericRtspAdapter(config)
