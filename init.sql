-- ============================================================
-- FABRIC ANALYZER - SCHEMA INITIALIZATION
-- PostgreSQL 16+
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE IF NOT EXISTS public.app_role AS ENUM ('operador', 'gestor');
CREATE TYPE IF NOT EXISTS public.analysis_item_type AS ENUM ('tecido', 'pecas');

-- ============================================================
-- 2. USERS TABLE (simples, sem Supabase)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);

-- ============================================================
-- 3. PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT,
  employee_code TEXT,
  shift TEXT,
  job_title TEXT,
  department TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);

-- ============================================================
-- 4. USER ROLES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'operador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles(user_id);

-- ============================================================
-- 5. ANALYSIS RECORDS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analysis_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reference_code TEXT NOT NULL UNIQUE,
  tissue_type TEXT NOT NULL,
  tissue_batch_code TEXT,
  result TEXT NOT NULL CHECK (result IN ('ok', 'fail')),
  failure_reason TEXT,
  processing_time_ms INTEGER NOT NULL CHECK (processing_time_ms > 0),
  delta_e_measured NUMERIC(8,4),
  delta_e_threshold SMALLINT CHECK (delta_e_threshold IN (1, 2, 3)),
  precision_percent NUMERIC(5,2) CHECK (precision_percent >= 0 AND precision_percent <= 100),
  required_precision_percent NUMERIC(5,2) CHECK (required_precision_percent >= 0 AND required_precision_percent <= 100),
  comparison_method TEXT DEFAULT 'CIEDE2000',
  reference_color_hex TEXT CHECK (reference_color_hex IS NULL OR reference_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  measured_color_hex TEXT CHECK (measured_color_hex IS NULL OR measured_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  analysis_type public.analysis_item_type NOT NULL DEFAULT 'tecido',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analysis_records_operator_user_id_analyzed_at_idx 
  ON public.analysis_records(operator_user_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS analysis_records_result_idx ON public.analysis_records(result);
CREATE INDEX IF NOT EXISTS analysis_records_analyzed_at_idx ON public.analysis_records(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS analysis_records_tissue_batch_code_idx ON public.analysis_records(tissue_batch_code);
CREATE INDEX IF NOT EXISTS analysis_records_analysis_type_idx ON public.analysis_records(analysis_type);

-- ============================================================
-- 6. OPERATOR CONFIGURATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.operator_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  delta_e SMALLINT NOT NULL DEFAULT 3 CHECK (delta_e IN (1, 2, 3)),
  sample_points SMALLINT NOT NULL DEFAULT 9 CHECK (sample_points IN (4, 9, 18)),
  sample_area_width_percent NUMERIC(5,2) NOT NULL DEFAULT 60 
    CHECK (sample_area_width_percent >= 0 AND sample_area_width_percent <= 100),
  sample_area_height_percent NUMERIC(5,2) NOT NULL DEFAULT 50 
    CHECK (sample_area_height_percent >= 0 AND sample_area_height_percent <= 100),
  reference_color_hex TEXT NOT NULL DEFAULT '#ffffff' 
    CHECK (reference_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  reference_color_r SMALLINT NOT NULL DEFAULT 255 CHECK (reference_color_r >= 0 AND reference_color_r <= 255),
  reference_color_g SMALLINT NOT NULL DEFAULT 255 CHECK (reference_color_g >= 0 AND reference_color_g <= 255),
  reference_color_b SMALLINT NOT NULL DEFAULT 255 CHECK (reference_color_b >= 0 AND reference_color_b <= 255),
  delta_configured BOOLEAN NOT NULL DEFAULT false,
  analysis_area_configured BOOLEAN NOT NULL DEFAULT false,
  color_configured BOOLEAN NOT NULL DEFAULT false,
  light_calibrated BOOLEAN NOT NULL DEFAULT false,
  system_step TEXT NOT NULL DEFAULT 'CONFIG' CHECK (system_step IN ('CONFIG', 'LIGHT', 'READY')),
  active_tissue_code TEXT NOT NULL DEFAULT 'TCD-LEGACY' CHECK (char_length(trim(active_tissue_code)) > 0),
  active_view TEXT NOT NULL DEFAULT 'home' 
    CHECK (active_view IN ('home', 'analysis', 'capture', 'delta', 'ambient')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_configurations_user_id_idx ON public.operator_configurations(user_id);

-- ============================================================
-- 7. UTILITY FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 8. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_operator_configurations_updated_at ON public.operator_configurations;
CREATE TRIGGER update_operator_configurations_updated_at
BEFORE UPDATE ON public.operator_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 9. INITIAL DATA
-- ============================================================

-- Inserir usuário operador de teste (sem Supabase)
-- senha: "operador123" (em produção, usar senha hash gerada por scrypt)
INSERT INTO public.users (email, password_hash)
VALUES (
  'operador@test.com',
  '$1$16$7c3f0fba3a3f0fba3a3f0fba3a3f0fba3a3f0fba3a3f0fba3a3f0fba3a3f0fba' -- exemplo hash (substituir em produção)
)
ON CONFLICT (email) DO NOTHING;

-- Obter o ID do usuário operador
WITH operator_user AS (
  SELECT id FROM public.users WHERE email = 'operador@test.com' LIMIT 1
)
INSERT INTO public.profiles (user_id, display_name, employee_code, job_title, active)
SELECT 
  id,
  'Operador Teste',
  'OP-001',
  'Operador',
  true
FROM operator_user
ON CONFLICT (user_id) DO NOTHING;

-- Atribuir role de operador
WITH operator_user AS (
  SELECT id FROM public.users WHERE email = 'operador@test.com' LIMIT 1
)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'operador'::public.app_role FROM operator_user
ON CONFLICT (user_id) DO NOTHING;

-- Criar configuração padrão para o operador
WITH operator_user AS (
  SELECT id FROM public.users WHERE email = 'operador@test.com' LIMIT 1
)
INSERT INTO public.operator_configurations (user_id)
SELECT id FROM operator_user
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 10. VERIFICAÇÃO FINAL
-- ============================================================

-- Mostrar dados inseridos (comentado, descomenta se precisar verificar)
-- SELECT 'users' AS table_name, COUNT(*) AS count FROM public.users
-- UNION ALL
-- SELECT 'profiles', COUNT(*) FROM public.profiles
-- UNION ALL
-- SELECT 'user_roles', COUNT(*) FROM public.user_roles
-- UNION ALL
-- SELECT 'operator_configurations', COUNT(*) FROM public.operator_configurations;
