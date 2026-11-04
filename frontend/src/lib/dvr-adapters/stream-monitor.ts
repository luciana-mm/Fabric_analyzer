import { DvrAdapterFactory } from "./index";
import type {
  DeviceConnectionStatus,
  DvrBrand,
  DvrDevice,
  StreamEvent,
  StreamEventSeverity,
} from "@/types/dvr";

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface MonitoredDvrState {
  dvrId: string;
  name: string;
  brand: DvrBrand;
  host: string;
  rtspPort: number;
  status: DeviceConnectionStatus;
  circuitState: CircuitBreakerState;
  consecutiveFailures: number;
  backoffSeconds: number;
  reconnectCount: number;
  latencyMs: number;
  activeSubtype: "main" | "sub";
  lastCheckedAt: string;
}

class StreamMonitorService {
  private states = new Map<string, MonitoredDvrState>();
  private events: StreamEvent[] = [];
  private readonly maxEvents = 100;
  private readonly failureThreshold = 3;
  private readonly maxBackoffSeconds = 30;

  constructor() {
    // Registra evento inicial de boot do serviço de monitoramento
    this.recordEvent({
      camera_id: "system-monitor",
      event_type: "connected",
      severity: "info",
      message: "Serviço de Monitoramento CFTV & Circuit Breaker inicializado",
      details: { failureThreshold: this.failureThreshold, maxBackoffSeconds: this.maxBackoffSeconds },
    });
  }

  public computeBackoffSeconds(failures: number): number {
    if (failures <= 0) return 1;
    const exp = Math.min(failures - 1, 5);
    return Math.min(this.maxBackoffSeconds, Math.pow(2, exp));
  }

  public getOrInitState(dvr: DvrDevice): MonitoredDvrState {
    const existing = this.states.get(dvr.id);
    if (existing) {
      existing.name = dvr.name;
      existing.host = dvr.host;
      existing.rtspPort = dvr.rtsp_port;
      return existing;
    }

    const initial: MonitoredDvrState = {
      dvrId: dvr.id,
      name: dvr.name,
      brand: dvr.brand,
      host: dvr.host,
      rtspPort: dvr.rtsp_port,
      status: dvr.status || "online",
      circuitState: "CLOSED",
      consecutiveFailures: 0,
      backoffSeconds: 1,
      reconnectCount: 0,
      latencyMs: dvr.brand === "mock" ? 8 : 18,
      activeSubtype: "main",
      lastCheckedAt: dvr.last_checked_at || new Date().toISOString(),
    };
    this.states.set(dvr.id, initial);
    return initial;
  }

  public async checkDvrHealth(dvr: DvrDevice): Promise<MonitoredDvrState> {
    const state = this.getOrInitState(dvr);
    const prevStatus = state.status;

    const adapter = DvrAdapterFactory.create({
      id: dvr.id,
      name: dvr.name,
      brand: dvr.brand,
      host: dvr.host,
      rtsp_port: dvr.rtsp_port,
      http_port: dvr.http_port,
      sdk_port: dvr.sdk_port,
      username: dvr.username,
      total_channels: dvr.total_channels,
    });

    const result = await adapter.testConnection();
    state.lastCheckedAt = new Date().toISOString();
    state.latencyMs = result.latencyMs;

    if (result.success) {
      state.consecutiveFailures = 0;
      state.backoffSeconds = 1;
      state.circuitState = "CLOSED";
      state.status = "online";

      if (prevStatus === "offline" || prevStatus === "error") {
        state.reconnectCount += 1;
        this.recordEvent({
          camera_id: dvr.id,
          event_type: "connected",
          severity: "info",
          message: `Reconexão automática concluída em '${dvr.name}' (${result.latencyMs}ms)`,
          details: { host: dvr.host, reconnectCount: state.reconnectCount, latencyMs: result.latencyMs },
        });
      }
    } else {
      state.consecutiveFailures += 1;
      state.backoffSeconds = this.computeBackoffSeconds(state.consecutiveFailures);

      if (state.consecutiveFailures >= this.failureThreshold) {
        state.circuitState = "OPEN";
        state.status = "error";
      } else {
        state.circuitState = "HALF_OPEN";
        state.status = "offline";
      }

      const severity: StreamEventSeverity =
        state.circuitState === "OPEN" ? "critical" : "warning";

      this.recordEvent({
        camera_id: dvr.id,
        event_type: prevStatus === "online" ? "disconnected" : "reconnecting",
        severity,
        message: `Falha de handshake em '${dvr.name}' (${dvr.host}:${dvr.rtsp_port}) · Backoff: ${state.backoffSeconds}s · Circuit: ${state.circuitState}`,
        details: {
          host: dvr.host,
          consecutiveFailures: state.consecutiveFailures,
          backoffSeconds: state.backoffSeconds,
          circuitState: state.circuitState,
        },
      });
    }

    this.states.set(dvr.id, state);
    return state;
  }

  public setStreamSubtype(dvrId: string, subtype: "main" | "sub"): MonitoredDvrState | null {
    const state = this.states.get(dvrId);
    if (!state) return null;
    state.activeSubtype = subtype;
    this.recordEvent({
      camera_id: dvrId,
      event_type: "connected",
      severity: "info",
      message: `Perfil de stream alterado para ${subtype === "main" ? "Main Stream (Alta Resolução / IA)" : "Sub Stream (Mosaico Leve)"} em '${state.name}'`,
      details: { subtype },
    });
    return state;
  }

  public recordEvent(params: {
    camera_id: string;
    event_type: StreamEvent["event_type"];
    severity: StreamEventSeverity;
    message: string;
    details?: Record<string, unknown>;
  }): StreamEvent {
    const ev: StreamEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      camera_id: params.camera_id,
      event_type: params.event_type,
      severity: params.severity,
      message: params.message,
      details: params.details,
      created_at: new Date().toISOString(),
    };
    this.events.unshift(ev);
    if (this.events.length > this.maxEvents) {
      this.events.length = this.maxEvents;
    }
    return ev;
  }

  public getEvents(limit = 30): StreamEvent[] {
    return this.events.slice(0, limit);
  }

  public getAllStates(): Record<string, MonitoredDvrState> {
    const out: Record<string, MonitoredDvrState> = {};
    for (const [id, st] of this.states.entries()) {
      out[id] = st;
    }
    return out;
  }
}

// Singleton global no processo Node.js para manter o estado entre requisições
const globalForMonitor = globalThis as unknown as {
  streamMonitorService?: StreamMonitorService;
};

export const streamMonitorService =
  globalForMonitor.streamMonitorService ?? new StreamMonitorService();

if (process.env.NODE_ENV !== "production") {
  globalForMonitor.streamMonitorService = streamMonitorService;
}
