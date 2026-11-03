-- Sincroniza colunas de operator_configurations com src/pages/api/operator-config.ts
ALTER TABLE public.operator_configurations
  ADD COLUMN IF NOT EXISTS sample_area_height_percent NUMERIC(5, 2) NOT NULL DEFAULT 50 CHECK (sample_area_height_percent >= 0 AND sample_area_height_percent <= 100),
  ADD COLUMN IF NOT EXISTS estampado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ambient_light_configured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ambient_light_reference_hex VARCHAR(7) CHECK (ambient_light_reference_hex IS NULL OR ambient_light_reference_hex ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN IF NOT EXISTS ambient_light_reference_r SMALLINT CHECK (ambient_light_reference_r IS NULL OR (ambient_light_reference_r >= 0 AND ambient_light_reference_r <= 255)),
  ADD COLUMN IF NOT EXISTS ambient_light_reference_g SMALLINT CHECK (ambient_light_reference_g IS NULL OR (ambient_light_reference_g >= 0 AND ambient_light_reference_g <= 255)),
  ADD COLUMN IF NOT EXISTS ambient_light_reference_b SMALLINT CHECK (ambient_light_reference_b IS NULL OR (ambient_light_reference_b >= 0 AND ambient_light_reference_b <= 255));
