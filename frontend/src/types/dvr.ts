export type DvrBrand = 'hikvision' | 'intelbras' | 'dahua' | 'onvif' | 'generic' | 'mock';

export type DeviceConnectionStatus = 'online' | 'offline' | 'connecting' | 'error';

export type StreamEventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface CameraDescriptor {
  id: string;
  channelNumber: number;
  name: string;
  streamUrl?: string;       // URL RTSP (mainstream ou substream)
  snapshotUrl?: string;     // URL HTTP/CGI/ISAPI para captura de frame estático
  resolution?: { width: number; height: number };
  fps?: number;
  online: boolean;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
  latencyMs: number;
  statusCode?: number;
  details?: Record<string, unknown>; // Firmware, modelo, portas ativas, canais detectados
}

export interface ImageCaptureResult {
  cameraId: string;
  mimeType: 'image/jpeg' | 'image/png';
  buffer: string | Buffer; // Base64 no frontend ou Buffer
  width: number;
  height: number;
  capturedAt: string | Date;
}

export interface DvrAdapter {
  testConnection(): Promise<ConnectionResult>;
  discoverCameras(): Promise<CameraDescriptor[]>;
  getCameraStream(cameraId: string, subtype?: 'main' | 'sub'): Promise<string>;
  captureSnapshot(cameraId: string): Promise<ImageCaptureResult>;
  getDeviceStatus(): Promise<{ online: boolean; uptime?: number; activeChannels: number }>;
}

export interface DvrDevice {
  id: string;
  name: string;
  brand: DvrBrand;
  host: string;
  rtsp_port: number;
  http_port: number;
  sdk_port?: number;
  username: string;
  password_encrypted?: string; // Nunca retornado em respostas GET públicas
  total_channels: number;
  status: DeviceConnectionStatus;
  last_checked_at?: string | null;
  metadata?: Record<string, unknown>;
  cameras?: CameraDevice[];
  created_at?: string;
  updated_at?: string;
}

export interface CameraDevice {
  id: string;
  dvr_id?: string;
  name: string;
  channel_number: number;
  stream_url_main?: string;
  stream_url_sub?: string;
  snapshot_url?: string;
  resolution_width?: number;
  resolution_height?: number;
  fps: number;
  is_active: boolean;
  status: DeviceConnectionStatus;
  last_frame_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StreamEvent {
  id: string;
  camera_id: string;
  event_type: 'connected' | 'disconnected' | 'reconnecting' | 'frame_drop' | 'error' | 'defect_detected';
  severity: StreamEventSeverity;
  message: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface CreateDvrPayload {
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
