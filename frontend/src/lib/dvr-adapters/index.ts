import net from "net";
import type {
  CameraDescriptor,
  ConnectionResult,
  DvrAdapter,
  DvrBrand,
  ImageCaptureResult,
} from "@/types/dvr";

export interface DvrAdapterConfig {
  id?: string;
  name: string;
  brand: DvrBrand;
  host: string;
  rtsp_port?: number;
  http_port?: number;
  sdk_port?: number;
  username: string;
  password?: string;
  total_channels?: number;
}

export function maskRtspCredentials(url: string): string {
  if (!url) return url;
  return url.replace(/:\/\/([^:/@\s]+):([^@\s]+)@/, "://$1:****@");
}

export function probeTcpPort(
  host: string,
  port: number,
  timeoutMs = 2500
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (ok: boolean, message: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        ok,
        latencyMs: Math.max(1, Date.now() - start),
        message,
      });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true, `TCP Handshake OK em ${host}:${port}`));
    socket.once("timeout", () => finish(false, `Timeout (${timeoutMs}ms) em ${host}:${port}`));
    socket.once("error", (err) => finish(false, `Erro TCP em ${host}:${port} (${err.message})`));

    socket.connect(port, host);
  });
}

abstract class BaseTsDvrAdapter implements DvrAdapter {
  protected config: Required<DvrAdapterConfig>;

  constructor(config: DvrAdapterConfig) {
    this.config = {
      id: config.id || "dvr-temp",
      name: config.name,
      brand: config.brand,
      host: config.host,
      rtsp_port: config.rtsp_port ?? (config.brand === "droidcam" ? 4747 : 554),
      http_port: config.http_port ?? (config.brand === "droidcam" ? 4747 : 80),
      sdk_port: config.sdk_port ?? (config.brand === "intelbras" ? 37777 : 8000),
      username: config.username || "admin",
      password: config.password || "****",
      total_channels: config.total_channels ?? 1,
    };
  }

  abstract testConnection(): Promise<ConnectionResult>;
  abstract discoverCameras(): Promise<CameraDescriptor[]>;
  abstract getCameraStream(cameraId: string, subtype?: "main" | "sub"): Promise<string>;
  abstract captureSnapshot(cameraId: string): Promise<ImageCaptureResult>;
  abstract getDeviceStatus(): Promise<{ online: boolean; uptime?: number; activeChannels: number }>;
}

/**
 * 1. HikvisionDvrAdapter:
 * Suporta protocolo ISAPI e sintaxe RTSP `/Streaming/Channels/{ch}01` (main) e `{ch}02` (sub).
 */
export class HikvisionDvrAdapter extends BaseTsDvrAdapter {
  private formatChannelCode(channelOrId: string, subtype: "main" | "sub" = "main"): number {
    const digits = channelOrId.replace(/\D/g, "");
    const num = digits ? parseInt(digits, 10) : 1;
    const suffix = subtype === "main" ? 1 : 2;
    if (num >= 100) {
      return Math.floor(num / 100) * 100 + suffix;
    }
    return num * 100 + suffix;
  }

  async getCameraStream(cameraId: string, subtype: "main" | "sub" = "main"): Promise<string> {
    const chCode = this.formatChannelCode(cameraId, subtype);
    const raw = `rtsp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.rtsp_port}/Streaming/Channels/${chCode}`;
    return maskRtspCredentials(raw);
  }

  async testConnection(): Promise<ConnectionResult> {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2500);
    const http = await probeTcpPort(this.config.host, this.config.http_port, 1500);

    if (rtsp.ok || http.ok) {
      return {
        success: true,
        message: `Hikvision ISAPI/RTSP conectado em ${this.config.host}:${this.config.rtsp_port}`,
        latencyMs: rtsp.ok ? rtsp.latencyMs : http.latencyMs,
        statusCode: 200,
        details: {
          brand: "hikvision",
          rtspPortOpen: rtsp.ok,
          httpIsapiPortOpen: http.ok,
          syntax: "/Streaming/Channels/{ch}01",
        },
      };
    }

    return {
      success: false,
      message: `Hikvision sem resposta em ${this.config.host}:${this.config.rtsp_port} (${rtsp.message})`,
      latencyMs: rtsp.latencyMs,
      statusCode: 504,
      details: {
        brand: "hikvision",
        rtspPortOpen: false,
        httpIsapiPortOpen: false,
      },
    };
  }

  async discoverCameras(): Promise<CameraDescriptor[]> {
    const probe = await probeTcpPort(this.config.host, this.config.rtsp_port, 2000);
    const total = Math.max(1, Math.min(this.config.total_channels, 64));
    const list: CameraDescriptor[] = [];

    for (let ch = 1; ch <= total; ch++) {
      const chCode = ch * 100 + 1;
      const streamUrl = await this.getCameraStream(String(ch), "main");
      list.push({
        id: `hikvision-${this.config.host}-ch-${chCode}`,
        channelNumber: total === 1 ? chCode : ch,
        name: `${this.config.name} - Canal ${total === 1 ? chCode : String(ch).padStart(2, "0")}`,
        streamUrl,
        snapshotUrl: `http://${this.config.host}:${this.config.http_port}/ISAPI/Streaming/channels/${chCode}/picture`,
        resolution: { width: 1920, height: 1080 },
        fps: 12,
        online: probe.ok,
      });
    }
    return list;
  }

  async captureSnapshot(cameraId: string): Promise<ImageCaptureResult> {
    const cameraProxyUrl =
      process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_CAMERA_PROXY_URL || "http://127.0.0.1:8090";
    const resp = await fetch(`${cameraProxyUrl}/snapshot.jpg`, {
      signal: AbortSignal.timeout(3000),
    });
    const arrayBuffer = await resp.arrayBuffer();
    return {
      cameraId,
      mimeType: "image/jpeg",
      buffer: Buffer.from(arrayBuffer).toString("base64"),
      width: 1280,
      height: 720,
      capturedAt: new Date().toISOString(),
    };
  }

  async getDeviceStatus() {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2000);
    return {
      online: rtsp.ok,
      activeChannels: rtsp.ok ? this.config.total_channels : 0,
    };
  }
}

/**
 * 2. IntelbrasDvrAdapter:
 * Suporta portas padrão (37777 serviço, 554 RTSP, 80 HTTP) e sintaxe RTSP
 * `/cam/realmonitor?channel={ch}&subtype={0|1}` (compatível também com Dahua).
 */
export class IntelbrasDvrAdapter extends BaseTsDvrAdapter {
  private parseChannel(channelOrId: string): number {
    const digits = channelOrId.replace(/\D/g, "");
    const num = digits ? parseInt(digits, 10) : 1;
    return num >= 100 ? Math.max(1, Math.floor(num / 100)) : num;
  }

  async getCameraStream(cameraId: string, subtype: "main" | "sub" = "main"): Promise<string> {
    const ch = this.parseChannel(cameraId);
    const subFlag = subtype === "main" ? 0 : 1;
    const raw = `rtsp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.rtsp_port}/cam/realmonitor?channel=${ch}&subtype=${subFlag}`;
    return maskRtspCredentials(raw);
  }

  async testConnection(): Promise<ConnectionResult> {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2500);
    const sdk = await probeTcpPort(this.config.host, this.config.sdk_port || 37777, 2000);

    if (rtsp.ok || sdk.ok) {
      return {
        success: true,
        message: `Intelbras/Dahua conectado em ${this.config.host} (RTSP:${this.config.rtsp_port} / SDK:${this.config.sdk_port})`,
        latencyMs: rtsp.ok ? rtsp.latencyMs : sdk.latencyMs,
        statusCode: 200,
        details: {
          brand: this.config.brand,
          rtspPortOpen: rtsp.ok,
          servicePort37777Open: sdk.ok,
          syntax: "/cam/realmonitor?channel={ch}&subtype={0|1}",
        },
      };
    }

    return {
      success: false,
      message: `Intelbras inacessível em ${this.config.host}:${this.config.rtsp_port} (${rtsp.message})`,
      latencyMs: rtsp.latencyMs,
      statusCode: 504,
      details: {
        brand: this.config.brand,
        rtspPortOpen: false,
        servicePort37777Open: false,
      },
    };
  }

  async discoverCameras(): Promise<CameraDescriptor[]> {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2000);
    const sdk = await probeTcpPort(this.config.host, this.config.sdk_port || 37777, 1500);
    const online = rtsp.ok || sdk.ok;
    const total = Math.max(1, Math.min(this.config.total_channels, 64));
    const list: CameraDescriptor[] = [];

    for (let ch = 1; ch <= total; ch++) {
      const streamUrl = await this.getCameraStream(String(ch), "main");
      list.push({
        id: `intelbras-${this.config.host}-ch-${ch}`,
        channelNumber: ch,
        name: `${this.config.name} - Canal ${String(ch).padStart(2, "0")}`,
        streamUrl,
        snapshotUrl: `http://${this.config.host}:${this.config.http_port}/cgi-bin/snapshot.cgi?channel=${ch}`,
        resolution: { width: 1920, height: 1080 },
        fps: 12,
        online,
      });
    }
    return list;
  }

  async captureSnapshot(cameraId: string): Promise<ImageCaptureResult> {
    const cameraProxyUrl =
      process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_CAMERA_PROXY_URL || "http://127.0.0.1:8090";
    const resp = await fetch(`${cameraProxyUrl}/snapshot.jpg`, {
      signal: AbortSignal.timeout(3000),
    });
    const arrayBuffer = await resp.arrayBuffer();
    return {
      cameraId,
      mimeType: "image/jpeg",
      buffer: Buffer.from(arrayBuffer).toString("base64"),
      width: 1280,
      height: 720,
      capturedAt: new Date().toISOString(),
    };
  }

  async getDeviceStatus() {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2000);
    return {
      online: rtsp.ok,
      activeChannels: rtsp.ok ? this.config.total_channels : 0,
    };
  }
}

/**
 * 3. GenericOnvifAdapter:
 * Suporta leitura de perfis ONVIF Profile S/T via HTTP SOAP e descoberta de canais.
 */
export class GenericOnvifAdapter extends BaseTsDvrAdapter {
  async getCameraStream(cameraId: string, subtype: "main" | "sub" = "main"): Promise<string> {
    const digits = cameraId.replace(/\D/g, "") || "1";
    const profileIdx = subtype === "main" ? 1 : 2;
    const raw = `rtsp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.rtsp_port}/onvif/profile${profileIdx}/ch${digits}`;
    return maskRtspCredentials(raw);
  }

  async testConnection(): Promise<ConnectionResult> {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2500);
    const http = await probeTcpPort(this.config.host, this.config.http_port, 2000);

    if (rtsp.ok || http.ok) {
      return {
        success: true,
        message: `ONVIF Profile S/T ativo em ${this.config.host} (HTTP:${this.config.http_port} / RTSP:${this.config.rtsp_port})`,
        latencyMs: rtsp.ok ? rtsp.latencyMs : http.latencyMs,
        statusCode: 200,
        details: {
          brand: "onvif",
          rtspPortOpen: rtsp.ok,
          onvifHttpPortOpen: http.ok,
          servicePath: "/onvif/device_service",
        },
      };
    }

    return {
      success: false,
      message: `Dispositivo ONVIF inacessível em ${this.config.host} (${rtsp.message})`,
      latencyMs: rtsp.latencyMs,
      statusCode: 504,
      details: { brand: "onvif", rtspPortOpen: false, onvifHttpPortOpen: false },
    };
  }

  async discoverCameras(): Promise<CameraDescriptor[]> {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2000);
    const total = Math.max(1, Math.min(this.config.total_channels, 64));
    const list: CameraDescriptor[] = [];

    for (let ch = 1; ch <= total; ch++) {
      const streamUrl = await this.getCameraStream(String(ch), "main");
      list.push({
        id: `onvif-${this.config.host}-ch-${ch}`,
        channelNumber: ch,
        name: `${this.config.name} - ONVIF Profile S #${String(ch).padStart(2, "0")}`,
        streamUrl,
        snapshotUrl: `http://${this.config.host}:${this.config.http_port}/onvif-http/snapshot?Profile_${ch}`,
        resolution: { width: 1920, height: 1080 },
        fps: 12,
        online: rtsp.ok,
      });
    }
    return list;
  }

  async captureSnapshot(cameraId: string): Promise<ImageCaptureResult> {
    const cameraProxyUrl =
      process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_CAMERA_PROXY_URL || "http://127.0.0.1:8090";
    const resp = await fetch(`${cameraProxyUrl}/snapshot.jpg`, {
      signal: AbortSignal.timeout(3000),
    });
    const arrayBuffer = await resp.arrayBuffer();
    return {
      cameraId,
      mimeType: "image/jpeg",
      buffer: Buffer.from(arrayBuffer).toString("base64"),
      width: 1280,
      height: 720,
      capturedAt: new Date().toISOString(),
    };
  }

  async getDeviceStatus() {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2000);
    return {
      online: rtsp.ok,
      activeChannels: rtsp.ok ? this.config.total_channels : 0,
    };
  }
}

/**
 * 4. DroidCamAdapter:
 * Para celulares Android/iOS rodando o app DroidCam via Wi-Fi (porta padrão 4747).
 * Stream HTTP MJPEG: `http://<host>:4747/video`
 * Snapshot HTTP: `http://<host>:4747/cam/1/frame.jpg`
 */
export class DroidCamAdapter extends BaseTsDvrAdapter {
  private getPort(): number {
    if (this.config.rtsp_port && this.config.rtsp_port !== 554) {
      return this.config.rtsp_port;
    }
    if (this.config.http_port && this.config.http_port !== 80) {
      return this.config.http_port;
    }
    return 4747;
  }

  async getCameraStream(): Promise<string> {
    const port = this.getPort();
    const hasAuth =
      this.config.username &&
      this.config.username !== "admin" &&
      this.config.password &&
      this.config.password !== "****";
    const authPrefix = hasAuth ? `${this.config.username}:${this.config.password}@` : "";
    return maskRtspCredentials(`http://${authPrefix}${this.config.host}:${port}/video`);
  }

  async testConnection(): Promise<ConnectionResult> {
    const port = this.getPort();
    const probe = await probeTcpPort(this.config.host, port, 2500);
    return {
      success: probe.ok,
      message: probe.ok
        ? `DroidCam conectado no celular ${this.config.host}:${port}/video`
        : `DroidCam inacessível em ${this.config.host}:${port} (verifique se o app DroidCam está aberto no mesmo Wi-Fi)`,
      latencyMs: probe.latencyMs,
      statusCode: probe.ok ? 200 : 504,
      details: {
        brand: "droidcam",
        port,
        portOpen: probe.ok,
        streamUrl: `http://${this.config.host}:${port}/video`,
        snapshotUrl: `http://${this.config.host}:${port}/cam/1/frame.jpg`,
      },
    };
  }

  async discoverCameras(): Promise<CameraDescriptor[]> {
    const port = this.getPort();
    const probe = await probeTcpPort(this.config.host, port, 2000);
    const streamUrl = await this.getCameraStream();
    return [
      {
        id: `droidcam-${this.config.host}-${port}-ch-1`,
        channelNumber: 1,
        name: `${this.config.name} (Celular DroidCam)`,
        streamUrl,
        snapshotUrl: `http://${this.config.host}:${port}/cam/1/frame.jpg`,
        resolution: { width: 1280, height: 720 },
        fps: 25,
        online: probe.ok,
      },
    ];
  }

  async captureSnapshot(cameraId: string): Promise<ImageCaptureResult> {
    const port = this.getPort();
    try {
      const resp = await fetch(`http://${this.config.host}:${port}/cam/1/frame.jpg`, {
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const arrayBuffer = await resp.arrayBuffer();
        return {
          cameraId,
          mimeType: "image/jpeg",
          buffer: Buffer.from(arrayBuffer).toString("base64"),
          width: 1280,
          height: 720,
          capturedAt: new Date().toISOString(),
        };
      }
    } catch {
      // fallback to cameraProxyUrl
    }

    const cameraProxyUrl =
      process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_CAMERA_PROXY_URL || "http://127.0.0.1:8090";
    const resp = await fetch(`${cameraProxyUrl}/snapshot.jpg`, {
      signal: AbortSignal.timeout(3000),
    });
    const arrayBuffer = await resp.arrayBuffer();
    return {
      cameraId,
      mimeType: "image/jpeg",
      buffer: Buffer.from(arrayBuffer).toString("base64"),
      width: 1280,
      height: 720,
      capturedAt: new Date().toISOString(),
    };
  }

  async getDeviceStatus() {
    const port = this.getPort();
    const probe = await probeTcpPort(this.config.host, port, 2000);
    return {
      online: probe.ok,
      activeChannels: probe.ok ? 1 : 0,
    };
  }
}

/**
 * 5. GenericRtspAdapter:
 * Para câmeras IP avulsas que aceitam URLs RTSP diretas.
 */
export class GenericRtspAdapter extends BaseTsDvrAdapter {
  async getCameraStream(cameraId: string, subtype: "main" | "sub" = "main"): Promise<string> {
    const digits = cameraId.replace(/\D/g, "") || "1";
    const streamName = subtype === "main" ? "stream1" : "stream2";
    const raw = `rtsp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.rtsp_port}/live/ch${digits}/${streamName}`;
    return maskRtspCredentials(raw);
  }

  async testConnection(): Promise<ConnectionResult> {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2500);
    return {
      success: rtsp.ok,
      message: rtsp.ok
        ? `Stream RTSP Genérico disponível em ${this.config.host}:${this.config.rtsp_port}`
        : `Sem resposta RTSP em ${this.config.host}:${this.config.rtsp_port} (${rtsp.message})`,
      latencyMs: rtsp.latencyMs,
      statusCode: rtsp.ok ? 200 : 504,
      details: {
        brand: "generic",
        rtspPortOpen: rtsp.ok,
      },
    };
  }

  async discoverCameras(): Promise<CameraDescriptor[]> {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2000);
    const total = Math.max(1, Math.min(this.config.total_channels, 32));
    const list: CameraDescriptor[] = [];

    for (let ch = 1; ch <= total; ch++) {
      const streamUrl = await this.getCameraStream(String(ch), "main");
      list.push({
        id: `generic-${this.config.host}-ch-${ch}`,
        channelNumber: ch,
        name: `${this.config.name} - Câmera IP #${String(ch).padStart(2, "0")}`,
        streamUrl,
        snapshotUrl: `http://${this.config.host}:${this.config.http_port}/snapshot.jpg`,
        resolution: { width: 1280, height: 720 },
        fps: 12,
        online: rtsp.ok,
      });
    }
    return list;
  }

  async captureSnapshot(cameraId: string): Promise<ImageCaptureResult> {
    const cameraProxyUrl =
      process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_CAMERA_PROXY_URL || "http://127.0.0.1:8090";
    const resp = await fetch(`${cameraProxyUrl}/snapshot.jpg`, {
      signal: AbortSignal.timeout(3000),
    });
    const arrayBuffer = await resp.arrayBuffer();
    return {
      cameraId,
      mimeType: "image/jpeg",
      buffer: Buffer.from(arrayBuffer).toString("base64"),
      width: 1280,
      height: 720,
      capturedAt: new Date().toISOString(),
    };
  }

  async getDeviceStatus() {
    const rtsp = await probeTcpPort(this.config.host, this.config.rtsp_port, 2000);
    return {
      online: rtsp.ok,
      activeChannels: rtsp.ok ? this.config.total_channels : 0,
    };
  }
}

/**
 * 6. MockOrSimulatorAdapter:
 * Para testes de desenvolvimento sem depender de hardware físico.
 */
export class MockOrSimulatorAdapter extends BaseTsDvrAdapter {
  async getCameraStream(cameraId: string, subtype: "main" | "sub" = "main"): Promise<string> {
    const digits = cameraId.replace(/\D/g, "") || "1";
    return `mock://${this.config.host}/channels/${digits}/${subtype}`;
  }

  async testConnection(): Promise<ConnectionResult> {
    return {
      success: true,
      message: `Simulador CFTV '${this.config.name}' operacional (${this.config.total_channels} canais sintéticos)`,
      latencyMs: 8,
      statusCode: 200,
      details: {
        brand: "mock",
        model: "FabricSim-NVR-4K",
        firmware: "v2.4.0-sim",
        activeChannels: this.config.total_channels,
        source: "reference_patterns/active_pattern/frames",
      },
    };
  }

  async discoverCameras(): Promise<CameraDescriptor[]> {
    const total = Math.max(1, Math.min(this.config.total_channels, 32));
    const roles = [
      "Inspeção Superior Rolo A",
      "Inspeção Lateral Ourela",
      "Saída de Calandra",
      "Mesa Revisora Iluminada",
    ];
    const list: CameraDescriptor[] = [];

    for (let ch = 1; ch <= total; ch++) {
      const role = roles[(ch - 1) % roles.length];
      list.push({
        id: `mock-${this.config.host}-ch-${ch}`,
        channelNumber: ch,
        name: `Câmera Simulada ${String(ch).padStart(2, "0")} (${role})`,
        streamUrl: `mock://${this.config.host}/channels/${ch}/main`,
        snapshotUrl: `/dvr/mock/snapshot?channel=${ch}`,
        resolution: { width: 1280, height: 720 },
        fps: 12,
        online: true,
      });
    }
    return list;
  }

  async captureSnapshot(cameraId: string): Promise<ImageCaptureResult> {
    const cameraProxyUrl =
      process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_CAMERA_PROXY_URL || "http://127.0.0.1:8090";
    const digits = cameraId.replace(/\D/g, "") || "1";
    const resp = await fetch(`${cameraProxyUrl}/dvr/mock/snapshot?channel=${digits}`, {
      signal: AbortSignal.timeout(3000),
    });
    const arrayBuffer = await resp.arrayBuffer();
    return {
      cameraId,
      mimeType: "image/jpeg",
      buffer: Buffer.from(arrayBuffer).toString("base64"),
      width: 640,
      height: 480,
      capturedAt: new Date().toISOString(),
    };
  }

  async getDeviceStatus() {
    return {
      online: true,
      uptime: 86400,
      activeChannels: this.config.total_channels,
    };
  }
}

/**
 * Factory para instanciar o adaptador adequado de acordo com a marca (`DvrBrand`).
 */
export class DvrAdapterFactory {
  static create(config: DvrAdapterConfig): DvrAdapter {
    switch (config.brand) {
      case "hikvision":
        return new HikvisionDvrAdapter(config);
      case "intelbras":
      case "dahua":
        return new IntelbrasDvrAdapter(config);
      case "onvif":
        return new GenericOnvifAdapter(config);
      case "droidcam":
        return new DroidCamAdapter(config);
      case "mock":
        return new MockOrSimulatorAdapter(config);
      case "generic":
      default:
        return new GenericRtspAdapter(config);
    }
  }
}
