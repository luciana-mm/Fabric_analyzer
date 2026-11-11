-- ============================================================
-- MIGRATION: Tabela de configuracoes de runtime para eliminar JSONs locais
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_runtime_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_runtime_settings_key ON public.system_runtime_settings(key);

INSERT INTO public.system_runtime_settings (key, value)
VALUES
  ('color_reference', '{"ref_a": null, "ref_b": null, "paleta": null}'::jsonb),
  ('active_operator_camera', '{"camera_id": "", "camera_name": "Câmera Superior Têxtil (Canal 101)", "brand": "hikvision", "stream_url": "rtsp://admin:****@192.168.1.64:554/Streaming/Channels/101", "channel": "101"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
