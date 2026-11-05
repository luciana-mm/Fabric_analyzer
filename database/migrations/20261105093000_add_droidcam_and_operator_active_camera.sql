-- ============================================================
-- MIGRATION: Suporte a DroidCam (Celular HTTP MJPEG) e Seleção de Câmera do Operário
-- ============================================================

ALTER TYPE public.dvr_brand ADD VALUE IF NOT EXISTS 'droidcam';

ALTER TABLE public.camera_devices
  ADD COLUMN IF NOT EXISTS is_operator_default BOOLEAN NOT NULL DEFAULT false;

-- Define a câmera inicial como padrão do operário caso nenhuma esteja marcada
UPDATE public.camera_devices
   SET is_operator_default = true
 WHERE id = (
   SELECT id FROM public.camera_devices ORDER BY created_at ASC LIMIT 1
 )
   AND NOT EXISTS (
     SELECT 1 FROM public.camera_devices WHERE is_operator_default = true
   );
