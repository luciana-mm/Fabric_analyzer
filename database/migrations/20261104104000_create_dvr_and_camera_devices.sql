-- ============================================================
-- MIGRATION: Módulo CFTV / DVR e Gerenciamento de Câmeras
-- Tabelas: dvr_devices, camera_devices, stream_events
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.dvr_brand AS ENUM (
    'hikvision',
    'intelbras',
    'dahua',
    'onvif',
    'generic',
    'mock'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.device_connection_status AS ENUM (
    'online',
    'offline',
    'connecting',
    'error'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stream_event_severity AS ENUM (
    'info',
    'warning',
    'error',
    'critical'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. TABELA DVR_DEVICES
CREATE TABLE IF NOT EXISTS public.dvr_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  brand public.dvr_brand NOT NULL DEFAULT 'hikvision',
  host VARCHAR(255) NOT NULL,
  rtsp_port INTEGER NOT NULL DEFAULT 554,
  http_port INTEGER NOT NULL DEFAULT 80,
  sdk_port INTEGER DEFAULT 8000,
  username VARCHAR(100) NOT NULL,
  password_encrypted TEXT NOT NULL,
  total_channels INTEGER NOT NULL DEFAULT 1 CHECK (total_channels >= 1 AND total_channels <= 128),
  status public.device_connection_status NOT NULL DEFAULT 'offline',
  last_checked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dvr_devices_brand ON public.dvr_devices(brand);
CREATE INDEX IF NOT EXISTS idx_dvr_devices_status ON public.dvr_devices(status);

-- 2. TABELA CAMERA_DEVICES
CREATE TABLE IF NOT EXISTS public.camera_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dvr_id UUID REFERENCES public.dvr_devices(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  channel_number INTEGER NOT NULL DEFAULT 1,
  stream_url_main TEXT,
  stream_url_sub TEXT,
  snapshot_url TEXT,
  resolution_width INTEGER,
  resolution_height INTEGER,
  fps INTEGER DEFAULT 12,
  is_active BOOLEAN NOT NULL DEFAULT true,
  status public.device_connection_status NOT NULL DEFAULT 'offline',
  last_frame_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_camera_devices_dvr_id ON public.camera_devices(dvr_id);
CREATE INDEX IF NOT EXISTS idx_camera_devices_status ON public.camera_devices(status);

-- 3. TABELA STREAM_EVENTS
CREATE TABLE IF NOT EXISTS public.stream_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID NOT NULL REFERENCES public.camera_devices(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  severity public.stream_event_severity NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stream_events_camera_id ON public.stream_events(camera_id);
CREATE INDEX IF NOT EXISTS idx_stream_events_created_at ON public.stream_events(created_at DESC);

-- Inserir dispositivo padrão referente à câmera atual do Fabric Analyzer
INSERT INTO public.dvr_devices (
  name, brand, host, rtsp_port, http_port, sdk_port, username, password_encrypted, total_channels, status, metadata
)
VALUES (
  'Hikvision Linha Industrial 01',
  'hikvision',
  '192.168.1.64',
  554,
  80,
  8000,
  'admin',
  'configured_in_env',
  1,
  'online',
  '{"notes": "Câmera principal de inspeção contínua de rolos de tecido", "channel": 101}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Inserir canal de câmera inicial vinculado ao DVR acima
INSERT INTO public.camera_devices (
  dvr_id, name, channel_number, stream_url_main, stream_url_sub, snapshot_url, fps, is_active, status
)
SELECT 
  d.id,
  'Câmera Superior Têxtil (Canal 101)',
  101,
  'rtsp://admin:****@192.168.1.64:554/Streaming/Channels/101',
  'rtsp://admin:****@192.168.1.64:554/Streaming/Channels/102',
  'http://192.168.1.64/ISAPI/Streaming/channels/101/picture',
  12,
  true,
  'online'
FROM public.dvr_devices d
WHERE d.host = '192.168.1.64'
LIMIT 1
ON CONFLICT DO NOTHING;
