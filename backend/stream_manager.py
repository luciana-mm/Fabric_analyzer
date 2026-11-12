import base64
import json
import logging
import os
import subprocess
import threading
import time
import urllib.request
import uuid
from collections import deque
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Deque, Dict, List, Optional

import cv2
import numpy as np

from dvr_adapters import DvrAdapterFactory, mask_rtsp_url
from dvr_types import (
    DeviceConnectionStatus,
    DvrBrand,
    DvrDeviceConfig,
    ImageCaptureResult,
)

try:
    from db import (
        get_runtime_setting,
        set_operator_active_camera,
        update_dvr_device_status,
    )
except ImportError:
    from backend.db import (
        get_runtime_setting,
        set_operator_active_camera,
        update_dvr_device_status,
    )

_log = logging.getLogger("stream-manager")

# Limite máximo de buffer MJPEG em RAM (5 MB) para evitar vazamento de memória
# caso um stream HTTP/FFmpeg malformado nunca envie o marcador EOI (0xFFD9).
MAX_MJPEG_BUFFER_BYTES = 5 * 1024 * 1024


class CircuitState(str, Enum):
    CLOSED = "CLOSED"          # Operação normal
    OPEN = "OPEN"              # Falhas consecutivas atingiram limite; aguardando backoff
    HALF_OPEN = "HALF_OPEN"    # Testando reconexão após janela de backoff


class StreamEventRecord:
    def __init__(
        self,
        camera_id: str,
        event_type: str,
        message: str,
        severity: str = "info",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.id = str(uuid.uuid4())
        self.camera_id = camera_id
        self.event_type = event_type
        self.severity = severity
        self.message = message
        self.details = details or {}
        self.created_at = datetime.utcnow().isoformat() + "Z"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "camera_id": self.camera_id,
            "event_type": self.event_type,
            "severity": self.severity,
            "message": self.message,
            "details": self.details,
            "created_at": self.created_at,
        }


class DeviceMonitorEntry:
    """
    Mantém o estado de monitoramento, backoff exponencial e circuit breaker de um DVR/Câmera.
    """

    def __init__(self, config: DvrDeviceConfig) -> None:
        self.config = config
        self.status: DeviceConnectionStatus = DeviceConnectionStatus.CONNECTING
        self.circuit_state: CircuitState = CircuitState.CLOSED
        self.consecutive_failures: int = 0
        self.failure_threshold: int = 3
        self.backoff_seconds: float = 1.0
        self.max_backoff_seconds: float = 30.0
        self.next_retry_ts: float = 0.0
        self.last_checked_at: Optional[str] = None
        self.last_latency_ms: float = 0.0
        self.reconnect_count: int = 0
        self.active_subtype: str = "main"

    def record_success(self, latency_ms: float) -> Optional[str]:
        """
        Atualiza estado para ONLINE, reseta backoff e retorna o tipo de transição se houve mudança.
        """
        prev_status = self.status
        self.status = DeviceConnectionStatus.ONLINE
        self.circuit_state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.backoff_seconds = 1.0
        self.last_latency_ms = latency_ms
        self.last_checked_at = datetime.utcnow().isoformat() + "Z"

        if prev_status in (DeviceConnectionStatus.OFFLINE, DeviceConnectionStatus.ERROR):
            self.reconnect_count += 1
            return "reconnected"
        if prev_status == DeviceConnectionStatus.CONNECTING:
            return "connected"
        return None

    def record_failure(self, latency_ms: float) -> str:
        """
        Incrementa falhas, calcula backoff exponencial (1s, 2s, 4s, 8s... até 30s)
        e aciona o Circuit Breaker caso ultrapasse o limite.
        """
        prev_status = self.status
        self.consecutive_failures += 1
        self.last_latency_ms = latency_ms
        self.last_checked_at = datetime.utcnow().isoformat() + "Z"

        # Backoff exponencial: 1s, 2s, 4s, 8s, 16s, 30s
        self.backoff_seconds = min(
            self.max_backoff_seconds, float(2 ** min(self.consecutive_failures - 1, 5))
        )
        self.next_retry_ts = time.time() + self.backoff_seconds

        if self.consecutive_failures >= self.failure_threshold:
            self.circuit_state = CircuitState.OPEN
            self.status = DeviceConnectionStatus.ERROR
        else:
            self.status = DeviceConnectionStatus.OFFLINE

        if prev_status == DeviceConnectionStatus.ONLINE:
            return "disconnected"
        return "reconnecting"

    def to_dict(self) -> Dict[str, Any]:
        adapter = DvrAdapterFactory.create(self.config)
        stream_main = adapter.get_camera_stream_url("1", "main")
        stream_sub = adapter.get_camera_stream_url("1", "sub")
        return {
            "id": self.config.id or f"dvr-{self.config.host}",
            "name": self.config.name,
            "brand": self.config.brand.value,
            "host": self.config.host,
            "rtspPort": self.config.rtsp_port,
            "status": self.status.value,
            "circuitState": self.circuit_state.value,
            "consecutiveFailures": self.consecutive_failures,
            "backoffSeconds": self.backoff_seconds,
            "reconnectCount": self.reconnect_count,
            "latencyMs": self.last_latency_ms,
            "lastCheckedAt": self.last_checked_at,
            "activeSubtype": self.active_subtype,
            "streamUrlMain": stream_main,
            "streamUrlSub": stream_sub,
        }


class StreamSessionManager:
    """
    Fase 3 — Gerenciador de Sessões de Stream, Captura de Snapshots sob demanda
    e Monitoramento Automático de Disponibilidade (Health Check & Circuit Breaker).
    """

    def __init__(self, check_interval_seconds: float = 15.0) -> None:
        self._lock = threading.Lock()
        self._devices: Dict[str, DeviceMonitorEntry] = {}
        self._events: Deque[StreamEventRecord] = deque(maxlen=150)
        self._snapshot_cache: Dict[str, tuple[float, ImageCaptureResult]] = {}
        self._snapshot_cache_ttl: float = 1.0  # Evita sobrecarga no DVR em múltiplos cliques simultâneos
        self._check_interval = check_interval_seconds
        self._running = True
        self._monitor_thread = threading.Thread(target=self._health_monitor_loop, daemon=True)
        self._monitor_thread.start()

    def register_device(self, config: DvrDeviceConfig) -> Dict[str, Any]:
        device_id = config.id or f"{config.brand.value}-{config.host}:{config.rtsp_port}"
        config.id = device_id
        with self._lock:
            if device_id not in self._devices:
                entry = DeviceMonitorEntry(config)
                self._devices[device_id] = entry
                self._emit_event_unlocked(
                    camera_id=device_id,
                    event_type="connected",
                    severity="info",
                    message=f"Dispositivo '{config.name}' ({config.host}) registrado no Health Monitor",
                    details={"brand": config.brand.value, "host": config.host},
                )
            else:
                self._devices[device_id].config = config
            return self._devices[device_id].to_dict()

    def get_device_config(self, device_id: str) -> Optional[DvrDeviceConfig]:
        with self._lock:
            entry = self._devices.get(device_id)
            return entry.config if entry else None

    def set_stream_subtype(self, device_id: str, subtype: str) -> Optional[Dict[str, Any]]:
        normalized = "sub" if subtype.lower() == "sub" else "main"
        with self._lock:
            entry = self._devices.get(device_id)
            if not entry:
                return None
            entry.active_subtype = normalized
            self._emit_event_unlocked(
                camera_id=device_id,
                event_type="connected",
                severity="info",
                message=f"Perfil de qualidade alterado para {normalized.upper()} STREAM em '{entry.config.name}'",
                details={"subtype": normalized},
            )
            return entry.to_dict()

    def capture_snapshot_on_demand(
        self, config: DvrDeviceConfig, channel_or_id: str = "1"
    ) -> Dict[str, Any]:
        """
        Captura snapshot sob demanda com proteção de cache de 1s para não sobrecarregar o DVR.
        """
        cache_key = f"{config.brand.value}:{config.host}:{config.rtsp_port}:{channel_or_id}"
        now = time.time()

        with self._lock:
            cached = self._snapshot_cache.get(cache_key)
            if cached and (now - cached[0]) < self._snapshot_cache_ttl:
                snap = cached[1]
                return self._format_snapshot_response(snap, config, from_cache=True)

        adapter = DvrAdapterFactory.create(config)
        snap = adapter.capture_snapshot(channel_or_id)

        with self._lock:
            self._snapshot_cache[cache_key] = (now, snap)
            self._emit_event_unlocked(
                camera_id=config.id or f"{config.host}-ch-{channel_or_id}",
                event_type="connected",
                severity="info",
                message=f"Snapshot capturado de '{config.name}' (Canal {channel_or_id}, {snap.width}x{snap.height})",
                details={"width": snap.width, "height": snap.height, "channel": channel_or_id},
            )

        return self._format_snapshot_response(snap, config, from_cache=False)

    @staticmethod
    def _format_snapshot_response(
        snap: ImageCaptureResult, config: DvrDeviceConfig, from_cache: bool = False
    ) -> Dict[str, Any]:
        b64_img = base64.b64encode(snap.buffer).decode("ascii")
        return {
            "cameraId": snap.camera_id,
            "dvrName": config.name,
            "brand": config.brand.value,
            "mimeType": snap.mime_type,
            "width": snap.width,
            "height": snap.height,
            "capturedAt": snap.captured_at.isoformat() + "Z",
            "fromCache": from_cache,
            "dataUrl": f"data:{snap.mime_type};base64,{b64_img}",
        }

    def run_check_now(self) -> List[Dict[str, Any]]:
        """Executa imediatamente uma rodada de verificação em todos os dispositivos registrados."""
        with self._lock:
            entries = list(self._devices.values())

        results: List[Dict[str, Any]] = []
        for entry in entries:
            self._check_single_entry(entry)
            with self._lock:
                results.append(entry.to_dict())
        return results

    def _check_single_entry(self, entry: DeviceMonitorEntry) -> None:
        now = time.time()
        if entry.circuit_state == CircuitState.OPEN and now < entry.next_retry_ts:
            return
        if entry.circuit_state == CircuitState.OPEN and now >= entry.next_retry_ts:
            entry.circuit_state = CircuitState.HALF_OPEN

        adapter = DvrAdapterFactory.create(entry.config)
        conn = adapter.test_connection()

        with self._lock:
            if conn.success:
                transition = entry.record_success(conn.latency_ms)
                if transition == "reconnected":
                    self._emit_event_unlocked(
                        camera_id=entry.config.id or entry.config.host,
                        event_type="connected",
                        severity="info",
                        message=f"Reconexão bem-sucedida com '{entry.config.name}' ({conn.latency_ms}ms)",
                        details={"latencyMs": conn.latency_ms, "reconnectCount": entry.reconnect_count},
                    )
                elif transition == "connected":
                    self._emit_event_unlocked(
                        camera_id=entry.config.id or entry.config.host,
                        event_type="connected",
                        severity="info",
                        message=f"Dispositivo '{entry.config.name}' ONLINE ({conn.latency_ms}ms)",
                        details={"latencyMs": conn.latency_ms},
                    )
            else:
                transition = entry.record_failure(conn.latency_ms)
                severity = "critical" if entry.circuit_state == CircuitState.OPEN else "warning"
                self._emit_event_unlocked(
                    camera_id=entry.config.id or entry.config.host,
                    event_type="disconnected" if transition == "disconnected" else "reconnecting",
                    severity=severity,
                    message=(
                        f"Falha em '{entry.config.name}' ({entry.config.host}:{entry.config.rtsp_port}). "
                        f"Backoff: {entry.backoff_seconds:.0f}s | Circuit: {entry.circuit_state.value}"
                    ),
                    details={
                        "consecutiveFailures": entry.consecutive_failures,
                        "backoffSeconds": entry.backoff_seconds,
                        "circuitState": entry.circuit_state.value,
                    },
                )
            dvr_id = entry.config.id or ""
            status_val = entry.status.value

        # Atualiza o status individual da linha no PostgreSQL fora do lock em memória
        if dvr_id:
            update_dvr_device_status(dvr_id, status_val)

    def _health_monitor_loop(self) -> None:
        while self._running:
            try:
                with self._lock:
                    entries = list(self._devices.values())
                for entry in entries:
                    if not self._running:
                        break
                    self._check_single_entry(entry)
            except Exception as exc:
                _log.error("Erro no loop de health check de DVRs: %s", exc)
            time.sleep(self._check_interval)

    def _emit_event_unlocked(
        self,
        camera_id: str,
        event_type: str,
        severity: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        record = StreamEventRecord(
            camera_id=camera_id,
            event_type=event_type,
            severity=severity,
            message=message,
            details=details,
        )
        self._events.appendleft(record)

    def emit_event(
        self,
        camera_id: str,
        event_type: str,
        severity: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            self._emit_event_unlocked(camera_id, event_type, severity, message, details)
            return self._events[0].to_dict()

    def get_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            return [ev.to_dict() for ev in list(self._events)[: max(1, min(limit, 150))]]

    def get_status_summary(self, active_camera_connected: bool, last_frame_ts: float) -> Dict[str, Any]:
        with self._lock:
            devices = [d.to_dict() for d in self._devices.values()]
            online_count = sum(1 for d in devices if d["status"] == "online")
            open_circuits = sum(1 for d in devices if d["circuitState"] == "OPEN")
            return {
                "activeStreamOnline": active_camera_connected,
                "lastFrameTimestamp": last_frame_ts,
                "monitoredDevicesCount": len(devices),
                "onlineDevicesCount": online_count,
                "openCircuitBreakers": open_circuits,
                "devices": devices,
                "recentEventsCount": len(self._events),
            }

    def stop(self) -> None:
        self._running = False
        if self._monitor_thread.is_alive():
            self._monitor_thread.join(timeout=1.5)


class CameraState:
    """
    Gerenciador principal da câmera ativa do Operário.
    Suporta RTSP (OpenCV / FFmpeg fallback), HTTP MJPEG (DroidCam / IP Webcam) e Simulador Mock,
    mantendo cache em memória de frame BGR decodificado e grayscale para evitar re-decodificações redundantes.
    """

    def __init__(
        self,
        default_rtsp_url: str = "mock://127.0.0.1/channel/1",
        camera_ip: str = "",
        camera_channel: str = "101",
        output_fps: float = 12.0,
        jpeg_quality: int = 80,
        connect_timeout_seconds: float = 5.0,
        use_ffmpeg_fallback: bool = True,
        legacy_state_path: Optional[Path] = None,
        on_switch_callback: Optional[Callable[[str], None]] = None,
    ) -> None:
        self.lock = threading.Lock()
        self._persist_lock = threading.Lock()
        self.output_fps = max(1.0, float(output_fps))
        self.jpeg_quality = int(jpeg_quality)
        self.connect_timeout_seconds = float(connect_timeout_seconds)
        self.use_ffmpeg_fallback = bool(use_ffmpeg_fallback)
        self.legacy_state_path = legacy_state_path or Path(__file__).with_name("active-operator-camera.json")
        self._on_switch_callback = on_switch_callback

        self.latest_frame: Optional[bytes] = None
        self.latest_bgr_frame: Optional[np.ndarray] = None
        self.latest_gray_frame: Optional[bytes] = None
        self._gray_source_ts: float = 0.0
        self.last_frame_ts: float = 0.0
        self.connected: bool = False
        self.running: bool = True
        self.active_clients: int = 0

        self.active_stream_url = default_rtsp_url
        self.active_camera_id = "cam-mock-1" if default_rtsp_url.startswith("mock://") else "cam-default-101"
        self.active_camera_name = (
            "Câmera Simulada 01 (Aguardando seleção no Gestor CFTV)"
            if default_rtsp_url.startswith("mock://")
            else f"Câmera Principal ({camera_ip or 'RTSP'} - Canal {camera_channel})"
        )
        self.active_brand = "mock" if default_rtsp_url.startswith("mock://") else "hikvision"
        self.active_channel = "1" if default_rtsp_url.startswith("mock://") else str(camera_channel)
        self._switch_version = 0
        self._load_persisted_camera()
        self._active_ffmpeg_proc: Optional[subprocess.Popen] = None
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def register_client(self) -> None:
        with self.lock:
            self.active_clients += 1

    def unregister_client(self) -> None:
        with self.lock:
            self.active_clients = max(0, self.active_clients - 1)

    def _update_frame(self, jpg_bytes: bytes, bgr_frame: Optional[np.ndarray] = None) -> None:
        now = time.time()
        with self.lock:
            self.latest_frame = jpg_bytes
            self.latest_bgr_frame = bgr_frame
            self.last_frame_ts = now
            self.connected = True

    def get_bgr_frame(self) -> Optional[np.ndarray]:
        """
        Retorna uma cópia segura do último frame BGR (decodificando sob demanda apenas se
        tiver vindo de um stream HTTP/FFmpeg bruto sem matriz BGR prévia).
        """
        with self.lock:
            bgr = self.latest_bgr_frame
            jpg_bytes = self.latest_frame

        if bgr is not None:
            return bgr.copy()

        if jpg_bytes is None:
            return None

        arr = np.frombuffer(jpg_bytes, dtype=np.uint8)
        decoded = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if decoded is not None:
            with self.lock:
                if self.latest_frame is jpg_bytes and self.latest_bgr_frame is None:
                    self.latest_bgr_frame = decoded
            return decoded.copy()
        return None

    def get_grayscale_jpeg(self, grayscale_fn: Callable[[np.ndarray], np.ndarray]) -> Optional[bytes]:
        """
        Retorna o frame em tons de cinza codificado em JPEG, reaproveitando o cache
        quando múltiplos clientes assistem ao mesmo timestamp de frame.
        """
        with self.lock:
            if self.latest_gray_frame is not None and self._gray_source_ts == self.last_frame_ts:
                return self.latest_gray_frame
            frame_ts = self.last_frame_ts

        bgr = self.get_bgr_frame()
        if bgr is None:
            return None

        gray = grayscale_fn(bgr)
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality]
        ok, jpg = cv2.imencode(".jpg", gray, encode_params)
        if not ok:
            return None

        gray_bytes = jpg.tobytes()
        with self.lock:
            if self.last_frame_ts == frame_ts:
                self.latest_gray_frame = gray_bytes
                self._gray_source_ts = frame_ts
        return gray_bytes

    def _load_persisted_camera(self) -> None:
        try:
            saved = get_runtime_setting("active_operator_camera")
            if isinstance(saved, dict):
                stream_url = str(saved.get("stream_url") or "").strip()
                if stream_url and "****" not in stream_url:
                    self.active_stream_url = stream_url
                    self.active_camera_id = str(saved.get("camera_id") or self.active_camera_id)
                    self.active_camera_name = str(saved.get("camera_name") or self.active_camera_name)
                    self.active_brand = str(saved.get("brand") or self.active_brand)
                    self.active_channel = str(saved.get("channel") or self.active_channel)
                    _log.info(
                        "Câmera ativa do operador restaurada do PostgreSQL: %s (%s)",
                        self.active_camera_name,
                        self.active_brand,
                    )
                    return
        except Exception as err:
            _log.warning("Falha ao recuperar câmera ativa do PostgreSQL: %s", err)

        try:
            if self.legacy_state_path and self.legacy_state_path.exists():
                saved = json.loads(self.legacy_state_path.read_text(encoding="utf-8"))
                stream_url = str(saved.get("stream_url") or "").strip()
                if stream_url and "****" not in stream_url:
                    self.active_stream_url = stream_url
                    self.active_camera_id = str(saved.get("camera_id") or self.active_camera_id)
                    self.active_camera_name = str(saved.get("camera_name") or self.active_camera_name)
                    self.active_brand = str(saved.get("brand") or self.active_brand)
                    self.active_channel = str(saved.get("channel") or self.active_channel)
                    if set_operator_active_camera(
                        self.active_camera_id,
                        self.active_camera_name,
                        self.active_brand,
                        self.active_stream_url,
                        self.active_channel,
                    ):
                        self.legacy_state_path.unlink(missing_ok=True)
                        _log.info(
                            "Câmera ativa migrada para o PostgreSQL e JSON legado removido: %s (%s)",
                            self.active_camera_name,
                            self.active_brand,
                        )
        except Exception as err:
            _log.warning("Could not load persisted operator camera: %s", err)

    def _persist_camera(
        self,
        version: int,
        camera_id: str,
        camera_name: str,
        brand: str,
        stream_url: str,
        channel: str,
    ) -> None:
        with self._persist_lock:
            if version != self._switch_version:
                return
            try:
                set_operator_active_camera(
                    camera_id=camera_id,
                    camera_name=camera_name,
                    brand=brand,
                    stream_url=stream_url,
                    channel=channel,
                )
            except Exception as err:
                _log.warning("Could not persist active operator camera: %s", err)

    def switch_camera(
        self,
        stream_url: str,
        camera_id: str = "",
        camera_name: str = "",
        brand: str = "generic_rtsp",
        channel: str = "1",
    ) -> dict:
        with self.lock:
            self.active_stream_url = stream_url
            self.active_camera_id = camera_id or self.active_camera_id
            self.active_camera_name = camera_name or f"Câmera {brand.upper()} (Canal {channel})"
            self.active_brand = brand
            self.active_channel = str(channel)
            self._switch_version += 1
            version_snapshot = self._switch_version
            cam_id_snapshot = self.active_camera_id
            cam_name_snapshot = self.active_camera_name
            brand_snapshot = self.active_brand
            url_snapshot = self.active_stream_url
            ch_snapshot = self.active_channel
            self.connected = False
            self.latest_frame = None
            self.latest_bgr_frame = None
            self.latest_gray_frame = None
            self._gray_source_ts = 0.0
            self.last_frame_ts = 0.0
            proc = self._active_ffmpeg_proc

        # Persiste no PostgreSQL FORA do self.lock para não bloquear o streaming MJPEG
        self._persist_camera(
            version=version_snapshot,
            camera_id=cam_id_snapshot,
            camera_name=cam_name_snapshot,
            brand=brand_snapshot,
            stream_url=url_snapshot,
            channel=ch_snapshot,
        )

        if proc is not None:
            try:
                proc.kill()
            except Exception:
                pass

        if self._on_switch_callback is not None:
            try:
                self._on_switch_callback(stream_url)
            except Exception:
                pass

        _log.info(
            "Switched active operator camera to id=%s name=%s brand=%s",
            cam_id_snapshot,
            cam_name_snapshot,
            brand_snapshot,
        )
        return self.get_active_info()

    def build_status_frame(self, status_text: str) -> bytes:
        with self.lock:
            cam_name = self.active_camera_name
            brand = self.active_brand
            channel = self.active_channel

        canvas = np.full((360, 640, 3), (15, 23, 42), dtype=np.uint8)
        for y in range(0, 360, 24):
            cv2.line(canvas, (0, y), (640, y), (25, 35, 58), 1)
        for x in range(0, 640, 24):
            cv2.line(canvas, (x, 0), (x, 360), (25, 35, 58), 1)

        cv2.rectangle(canvas, (20, 20), (620, 340), (56, 189, 248), 1)
        cv2.putText(
            canvas,
            f"CAMERA DO OPERARIO ({brand.upper()} - CH {channel})",
            (40, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (56, 189, 248),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            cam_name[:48],
            (40, 115),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.58,
            (226, 232, 240),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            status_text[:55],
            (40, 185),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.58,
            (251, 191, 36),
            1,
            cv2.LINE_AA,
        )
        ts_str = time.strftime("%H:%M:%S")
        cv2.putText(
            canvas,
            f"Sincronizado em tempo real | {ts_str}",
            (40, 310),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (148, 163, 184),
            1,
            cv2.LINE_AA,
        )
        _, jpg = cv2.imencode(".jpg", canvas, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return jpg.tobytes()

    def get_active_info(self) -> dict:
        with self.lock:
            return {
                "cameraId": self.active_camera_id,
                "cameraName": self.active_camera_name,
                "brand": self.active_brand,
                "channel": self.active_channel,
                "streamUrlMasked": mask_rtsp_url(self.active_stream_url),
                "connected": self.connected,
                "lastFrameTs": self.last_frame_ts,
                "switchVersion": self._switch_version,
                "activeClients": self.active_clients,
            }

    def _read_http_mjpeg_stream(self, url: str, version: int) -> bool:
        """
        Leitor nativo de streams HTTP MJPEG (DroidCam / IP Webcam) com limite de buffer.
        """
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (FabricAnalyzer Backend)"},
            )
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                content_type = (resp.headers.get("Content-Type") or "").lower()
                if "text/html" in content_type:
                    html_preview = resp.read(512).decode("utf-8", errors="ignore")
                    _log.warning(
                        "HTTP camera stream (%s) returned HTML instead of MJPEG: %s",
                        self.active_camera_name,
                        "DroidCam is Busy" if "droidcam_busy" in html_preview else content_type,
                    )
                    self.connected = False
                    return False

                buffer = b""
                while self.running and self._switch_version == version:
                    chunk = resp.read(4096)
                    if not chunk:
                        break
                    buffer += chunk
                    if len(buffer) > MAX_MJPEG_BUFFER_BYTES:
                        last_soi = buffer.rfind(b"\xff\xd8")
                        buffer = buffer[last_soi:] if last_soi != -1 else b""

                    while True:
                        start = buffer.find(b"\xff\xd8")
                        end = buffer.find(b"\xff\xd9", start + 2) if start != -1 else -1
                        if start != -1 and end != -1:
                            jpg = buffer[start : end + 2]
                            buffer = buffer[end + 2 :]
                            self._update_frame(jpg, bgr_frame=None)
                        else:
                            break
                self.connected = False
                return True
        except Exception as err:
            _log.warning("Direct HTTP MJPEG read failed for %s: %s", self.active_camera_name, err)
            self.connected = False
            return False

    def _capture_loop(self) -> None:
        backoff = 1.0
        while self.running:
            try:
                with self.lock:
                    url = self.active_stream_url
                    version = self._switch_version
                    brand = self.active_brand
                    channel = self.active_channel

                frame_interval = 1.0 / self.output_fps if self.output_fps > 0 else 0.08

                # 1. Simulador Mock
                if url.startswith("mock://") or brand == "mock":
                    from dvr_adapters.utils import load_or_generate_mock_frame

                    try:
                        ch_num = int(channel) if str(channel).isdigit() else 1
                    except ValueError:
                        ch_num = 1
                    while self.running and self._switch_version == version:
                        jpg_bytes, _, _ = load_or_generate_mock_frame(channel=ch_num)
                        self._update_frame(jpg_bytes, bgr_frame=None)
                        time.sleep(frame_interval)
                    continue

                # 2. HTTP / HTTPS MJPEG (DroidCam / IP Webcam)
                if url.lower().startswith(("http://", "https://")):
                    _log.info("Opening direct HTTP MJPEG stream for active camera (%s)...", self.active_camera_name)
                    ok_http = self._read_http_mjpeg_stream(url, version)
                    if not ok_http and self._switch_version == version:
                        time.sleep(1.5)
                    continue

                # 3. RTSP via OpenCV
                _log.info("Attempting OpenCV capture for active camera (%s)...", self.active_camera_name)
                capture = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
                try:
                    capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                except Exception:
                    pass
                try:
                    capture.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
                    capture.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
                except Exception:
                    pass

                started_at = time.time()
                self.connected = capture.isOpened()

                if not self.connected:
                    _log.warning("OpenCV failed to open stream (%s), will retry or fallback", self.active_camera_name)
                    capture.release()
                    if self.use_ffmpeg_fallback:
                        self._run_ffmpeg_for_version(url, version)
                        continue
                    time.sleep(min(backoff, 10.0))
                    backoff = min(backoff * 2, 10.0)
                    continue

                backoff = 1.0
                last_encode_ts = 0.0

                while self.running and self._switch_version == version:
                    ok, frame = capture.read()
                    if not ok or frame is None:
                        self.connected = False
                        _log.warning("OpenCV read returned not ok, breaking to reconnect")
                        break

                    now = time.time()
                    # Controle de taxa (throttling) para não codificar JPEGs acima do OUTPUT_FPS
                    if (now - last_encode_ts) < (frame_interval * 0.85):
                        continue

                    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality]
                    encoded_ok, jpg = cv2.imencode(".jpg", frame, encode_params)
                    if not encoded_ok:
                        continue

                    last_encode_ts = now
                    self._update_frame(jpg.tobytes(), bgr_frame=frame)

                    if now - started_at > self.connect_timeout_seconds and self.last_frame_ts == 0:
                        self.connected = False
                        _log.warning("Connect timeout exceeded without frames")
                        break

                capture.release()
                self.connected = False
                time.sleep(0.3)
            except Exception as e:
                self.connected = False
                _log.exception("Unexpected error in capture loop: %s", e)
                time.sleep(1.0)

    def stop(self) -> None:
        self.running = False
        if self._active_ffmpeg_proc is not None:
            try:
                self._active_ffmpeg_proc.kill()
            except Exception:
                pass
        if self.thread.is_alive():
            self.thread.join(timeout=1.0)

    def _run_ffmpeg_for_version(self, url: str, version: int) -> None:
        """
        Subprocesso FFmpeg para RTSP/HTTP com stderr=DEVNULL (evita deadlock de pipe OS)
        e limite de buffer MJPEG em memória.
        """
        _log.info("Starting ffmpeg fallback for %s", self.active_camera_name)
        cmd = ["ffmpeg"]
        if url.lower().startswith("rtsp://"):
            cmd.extend(["-rtsp_transport", "tcp"])
        cmd.extend([
            "-i",
            url,
            "-f",
            "mjpeg",
            "-q:v",
            "5",
            "-r",
            str(int(self.output_fps)),
            "pipe:1",
        ])

        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            with self.lock:
                self._active_ffmpeg_proc = proc

            stdout = proc.stdout
            buffer = b""

            while self.running and self._switch_version == version:
                if stdout is None:
                    break
                chunk = stdout.read(4096)
                if not chunk:
                    _log.warning("ffmpeg stdout closed or no data")
                    break
                buffer += chunk
                if len(buffer) > MAX_MJPEG_BUFFER_BYTES:
                    last_soi = buffer.rfind(b"\xff\xd8")
                    buffer = buffer[last_soi:] if last_soi != -1 else b""

                while True:
                    start = buffer.find(b"\xff\xd8")
                    end = buffer.find(b"\xff\xd9", start + 2) if start != -1 else -1
                    if start != -1 and end != -1:
                        jpg = buffer[start : end + 2]
                        buffer = buffer[end + 2 :]
                        self._update_frame(jpg, bgr_frame=None)
                    else:
                        break

            self.connected = False
            try:
                proc.kill()
            except Exception:
                pass
        except FileNotFoundError:
            self.connected = False
            _log.error("ffmpeg not found in PATH. Install ffmpeg to use fallback.")
            time.sleep(2.0)
        except Exception as e:
            self.connected = False
            _log.exception("ffmpeg loop error: %s", e)
            time.sleep(2.0)


class ChannelStreamWorker:
    """
    Worker independente de captura por canal para o Mosaico Multi-Câmera.
    Encerra automaticamente por inatividade (lazy-loading) quando o mosaico é fechado.
    """

    def __init__(
        self,
        worker_key: str,
        stream_url: str,
        camera_name: str,
        brand: str,
        host: str,
        port: int,
        channel: str,
        output_fps: float = 12.0,
        jpeg_quality: int = 80,
        use_ffmpeg_fallback: bool = True,
    ) -> None:
        self.worker_key = worker_key
        self.stream_url = stream_url
        self.camera_name = camera_name
        self.brand = brand
        self.host = host
        self.port = port
        self.channel = channel
        self.output_fps = max(1.0, float(output_fps))
        self.jpeg_quality = int(jpeg_quality)
        self.use_ffmpeg_fallback = bool(use_ffmpeg_fallback)

        self.lock = threading.Lock()
        self.latest_frame: Optional[bytes] = None
        self.last_frame_ts: float = 0.0
        self.last_client_ts: float = time.time()
        self.connected: bool = False
        self.running: bool = True
        self._proc: Optional[subprocess.Popen] = None
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def touch(self) -> None:
        self.last_client_ts = time.time()

    def build_status_frame(self, status_text: str) -> bytes:
        canvas = np.full((360, 640, 3), (15, 23, 42), dtype=np.uint8)
        for y in range(0, 360, 24):
            cv2.line(canvas, (0, y), (640, y), (25, 35, 58), 1)
        for x in range(0, 640, 24):
            cv2.line(canvas, (x, 0), (x, 360), (25, 35, 58), 1)

        cv2.rectangle(canvas, (20, 20), (620, 340), (56, 189, 248), 1)
        cv2.putText(
            canvas,
            f"{self.brand.upper()} - CANAL {self.channel}",
            (40, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (56, 189, 248),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            f"Host: {self.host}:{self.port}",
            (40, 115),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (203, 213, 225),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            status_text[:55],
            (40, 185),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.58,
            (251, 191, 36),
            1,
            cv2.LINE_AA,
        )
        ts_str = time.strftime("%H:%M:%S")
        cv2.putText(
            canvas,
            f"Stream Independente Mosaico | {ts_str}",
            (40, 310),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (148, 163, 184),
            1,
            cv2.LINE_AA,
        )
        _, jpg = cv2.imencode(".jpg", canvas, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return jpg.tobytes()

    def stop(self) -> None:
        self.running = False
        if self._proc is not None:
            try:
                self._proc.kill()
            except Exception:
                pass

    def _read_http_mjpeg_once(self) -> bool:
        try:
            req = urllib.request.Request(
                self.stream_url,
                headers={"User-Agent": "Mozilla/5.0 (FabricAnalyzer Mosaic)"},
            )
            with urllib.request.urlopen(req, timeout=4.5) as resp:
                ctype = (resp.headers.get("Content-Type") or "").lower()
                if "text/html" in ctype:
                    self.connected = False
                    return False
                buf = b""
                while self.running and (time.time() - self.last_client_ts <= 25.0):
                    chunk = resp.read(4096)
                    if not chunk:
                        break
                    buf += chunk
                    if len(buf) > MAX_MJPEG_BUFFER_BYTES:
                        last_soi = buf.rfind(b"\xff\xd8")
                        buf = buf[last_soi:] if last_soi != -1 else b""
                    while True:
                        s = buf.find(b"\xff\xd8")
                        e = buf.find(b"\xff\xd9", s + 2) if s != -1 else -1
                        if s != -1 and e != -1:
                            jpg = buf[s : e + 2]
                            buf = buf[e + 2 :]
                            with self.lock:
                                self.latest_frame = jpg
                                self.last_frame_ts = time.time()
                                self.connected = True
                        else:
                            break
                self.connected = False
                return True
        except Exception:
            self.connected = False
            return False

    def _run_loop(self) -> None:
        from dvr_adapters.utils import load_or_generate_mock_frame

        frame_interval = 1.0 / max(1.0, self.output_fps)

        while self.running:
            if time.time() - self.last_client_ts > 25.0:
                _log.info("Stopping idle mosaic worker for %s (%s:%s)", self.camera_name, self.host, self.port)
                self.running = False
                break

            if self.stream_url.startswith("mock://") or self.brand == "mock":
                ch_num = int(self.channel) if str(self.channel).isdigit() else 1
                jpg_bytes, _, _ = load_or_generate_mock_frame(channel=ch_num)
                with self.lock:
                    self.latest_frame = jpg_bytes
                    self.last_frame_ts = time.time()
                    self.connected = True
                time.sleep(frame_interval)
                continue

            if self.stream_url.lower().startswith(("http://", "https://")):
                ok_http = self._read_http_mjpeg_once()
                if not ok_http and self.running:
                    time.sleep(1.5)
                continue

            try:
                cap = cv2.VideoCapture(self.stream_url, cv2.CAP_FFMPEG)
                try:
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 4000)
                    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 4000)
                except Exception:
                    pass

                if not cap.isOpened():
                    cap.release()
                    self.connected = False
                    if self.use_ffmpeg_fallback:
                        self._run_ffmpeg_once()
                    else:
                        time.sleep(2.0)
                    continue

                last_encode_ts = 0.0
                while self.running and (time.time() - self.last_client_ts <= 25.0):
                    ok, frame = cap.read()
                    if not ok or frame is None:
                        self.connected = False
                        break
                    now = time.time()
                    if (now - last_encode_ts) < (frame_interval * 0.85):
                        continue
                    ok_enc, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality])
                    if ok_enc:
                        last_encode_ts = now
                        with self.lock:
                            self.latest_frame = jpg.tobytes()
                            self.last_frame_ts = now
                            self.connected = True
                cap.release()
            except Exception as err:
                _log.debug("Mosaic worker error (%s): %s", self.camera_name, err)
                time.sleep(1.5)

    def _run_ffmpeg_once(self) -> None:
        cmd = ["ffmpeg"]
        if self.stream_url.lower().startswith("rtsp://"):
            cmd.extend(["-rtsp_transport", "tcp"])
        cmd.extend([
            "-i",
            self.stream_url,
            "-f",
            "mjpeg",
            "-q:v",
            "6",
            "-r",
            str(int(max(6, min(self.output_fps, 12)))),
            "pipe:1",
        ])
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            self._proc = proc
            stdout = proc.stdout
            buf = b""
            while self.running and (time.time() - self.last_client_ts <= 25.0):
                if stdout is None:
                    break
                chunk = stdout.read(4096)
                if not chunk:
                    break
                buf += chunk
                if len(buf) > MAX_MJPEG_BUFFER_BYTES:
                    last_soi = buf.rfind(b"\xff\xd8")
                    buf = buf[last_soi:] if last_soi != -1 else b""
                while True:
                    s = buf.find(b"\xff\xd8")
                    e = buf.find(b"\xff\xd9", s + 2) if s != -1 else -1
                    if s != -1 and e != -1:
                        jpg = buf[s : e + 2]
                        buf = buf[e + 2 :]
                        with self.lock:
                            self.latest_frame = jpg
                            self.last_frame_ts = time.time()
                            self.connected = True
                    else:
                        break
            try:
                proc.kill()
            except Exception:
                pass
        except Exception:
            time.sleep(2.0)


class ChannelStreamPool:
    def __init__(
        self,
        output_fps: float = 12.0,
        jpeg_quality: int = 80,
        use_ffmpeg_fallback: bool = True,
    ) -> None:
        self._lock = threading.Lock()
        self._workers: dict[str, ChannelStreamWorker] = {}
        self.output_fps = output_fps
        self.jpeg_quality = jpeg_quality
        self.use_ffmpeg_fallback = use_ffmpeg_fallback

    def stop_worker(self, worker_key: str) -> None:
        with self._lock:
            existing = self._workers.pop(worker_key, None)
            if existing:
                existing.stop()

    def stop_matching(self, stream_url: str) -> None:
        with self._lock:
            keys_to_stop = [
                k for k, w in self._workers.items() if w.stream_url == stream_url or (w.host and w.host in stream_url)
            ]
            for k in keys_to_stop:
                w = self._workers.pop(k, None)
                if w:
                    w.stop()

    def stop_all(self) -> None:
        with self._lock:
            workers = list(self._workers.values())
            self._workers.clear()
        for w in workers:
            w.stop()

    def get_or_create(
        self,
        worker_key: str,
        stream_url: str,
        camera_name: str,
        brand: str,
        host: str,
        port: int,
        channel: str,
    ) -> ChannelStreamWorker:
        with self._lock:
            existing = self._workers.get(worker_key)
            if existing and existing.running and existing.stream_url == stream_url:
                existing.touch()
                return existing
            if existing:
                existing.stop()
            worker = ChannelStreamWorker(
                worker_key=worker_key,
                stream_url=stream_url,
                camera_name=camera_name,
                brand=brand,
                host=host,
                port=port,
                channel=channel,
                output_fps=self.output_fps,
                jpeg_quality=self.jpeg_quality,
                use_ffmpeg_fallback=self.use_ffmpeg_fallback,
            )
            self._workers[worker_key] = worker
            return worker
