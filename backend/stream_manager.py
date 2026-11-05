import base64
import logging
import threading
import time
import uuid
from collections import deque
from datetime import datetime
from enum import Enum
from typing import Any, Deque, Dict, List, Optional

from dvr_adapters import DvrAdapterFactory, mask_rtsp_url
from dvr_types import (
    DeviceConnectionStatus,
    DvrBrand,
    DvrDeviceConfig,
    ImageCaptureResult,
)

_log = logging.getLogger("stream-manager")


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
