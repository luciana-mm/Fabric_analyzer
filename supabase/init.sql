-- ============================================================
-- FABRIC ANALYZER - SCHEMA COMPLETO DO BANCO
-- PostgreSQL 14+
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE IF NOT EXISTS public.app_role AS ENUM ('operador', 'gestor');
CREATE TYPE IF NOT EXISTS public.analysis_item_type AS ENUM ('tecido', 'pecas');

-- ============================================================
-- 2. TABELA USERS (Autenticação)
-- ============================================================
DROP TABLE IF EXISTS public.analysis_records CASCADE;
DROP TABLE IF EXISTS public.operator_configurations CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON public.users(email);

-- ============================================================
-- 3. TABELA PROFILES (Informações Estendidas)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT,
  employee_code TEXT,
  shift TEXT,
  job_title TEXT,
  department TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- ============================================================
-- 4. TABELA USER_ROLES (Autorização)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'operador',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- ============================================================
-- 5. TABELA OPERATOR_CONFIGURATIONS (Configurações por Operador)
-- ============================================================
CREATE TABLE public.operator_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Configurações de Análise
  delta_e SMALLINT DEFAULT 3 CHECK (delta_e IN (1, 2, 3)),
  sample_points SMALLINT DEFAULT 9 CHECK (sample_points IN (4, 9, 18)),
  sample_area_width_percent NUMERIC(5, 2) DEFAULT 60 CHECK (sample_area_width_percent >= 0 AND sample_area_width_percent <= 100),
  
  -- Cor de Referência (Hex)
  reference_color_hex VARCHAR(7) CHECK (reference_color_hex IS NULL OR reference_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  reference_color_r SMALLINT CHECK (reference_color_r IS NULL OR (reference_color_r >= 0 AND reference_color_r <= 255)),
  reference_color_g SMALLINT CHECK (reference_color_g IS NULL OR (reference_color_g >= 0 AND reference_color_g <= 255)),
  reference_color_b SMALLINT CHECK (reference_color_b IS NULL OR (reference_color_b >= 0 AND reference_color_b <= 255)),
  
  -- Status de Configuração
  delta_configured BOOLEAN DEFAULT false,
  analysis_area_configured BOOLEAN DEFAULT false,
  color_configured BOOLEAN DEFAULT false,
  light_calibrated BOOLEAN DEFAULT false,
  
  -- Estado do Sistema
  system_step VARCHAR(50) DEFAULT 'CONFIG' CHECK (system_step IN ('CONFIG', 'LIGHT', 'READY')),
  
  -- Estado da UI
  active_tissue_code TEXT,
  active_view TEXT DEFAULT 'MAIN',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operator_configs_user_id ON public.operator_configurations(user_id);

-- ============================================================
-- 6. TABELA ANALYSIS_RECORDS (Resultados de Análise)
-- ============================================================
CREATE TABLE public.analysis_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reference_code TEXT NOT NULL UNIQUE,
  
  -- Informações de Análise
  tissue_type TEXT NOT NULL,
  tissue_batch_code TEXT,
  analysis_type analysis_item_type DEFAULT 'tecido',
  result VARCHAR(50) NOT NULL CHECK (result IN ('ok', 'fail')),
  failure_reason TEXT,
  
  -- Métricas de Performance
  processing_time_ms INTEGER NOT NULL CHECK (processing_time_ms > 0),
  
  -- Métricas de Cor
  delta_e_measured NUMERIC(8, 4),
  delta_e_threshold SMALLINT CHECK (delta_e_threshold IS NULL OR delta_e_threshold IN (1, 2, 3)),
  precision_percent NUMERIC(5, 2) CHECK (precision_percent IS NULL OR (precision_percent >= 0 AND precision_percent <= 100)),
  required_precision_percent NUMERIC(5, 2) CHECK (required_precision_percent IS NULL OR (required_precision_percent >= 0 AND required_precision_percent <= 100)),
  comparison_method TEXT DEFAULT 'CIEDE2000',
  
  -- Cores (Hex)
  reference_color_hex VARCHAR(7) CHECK (reference_color_hex IS NULL OR reference_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  measured_color_hex VARCHAR(7) CHECK (measured_color_hex IS NULL OR measured_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  
  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Índices para Performance
CREATE INDEX idx_analysis_operator_analyzed ON public.analysis_records(operator_user_id, analyzed_at DESC);
CREATE INDEX idx_analysis_result ON public.analysis_records(result);
CREATE INDEX idx_analysis_analyzed_at ON public.analysis_records(analyzed_at DESC);
CREATE INDEX idx_analysis_tissue_batch ON public.analysis_records(tissue_batch_code);
CREATE INDEX idx_analysis_type ON public.analysis_records(analysis_type);

-- ============================================================
-- 7. INSERIR USUÁRIOS PADRÃO
-- ============================================================
INSERT INTO public.users (email, password_hash) VALUES
  ('operador@empresa.com', 'ab31411c298996a2ce6d6eb3a19d1fd8.1d1a370733f31475e0acacde2bc7e04d32ce90e0a0e5c35e18cb26ac101ee29d1e2b8f98c758a226f32c7bb828f43efaa197336a3cdc38bbc504d520308d6c4e'),
  ('gestor@empresa.com', '278e1f5acf8b4af28832650c8f233006.4dcb03deb9822fafd3fd29547e078d9324b1f81e1ea671872b6810d821129e4ffb39b89beae31caec8723044886294276e5595adf1e9c943f51c8f5cc5a01de7');

-- ============================================================
-- 8. CRIAR PERFIS PADRÃO
-- ============================================================
INSERT INTO public.profiles (user_id, display_name, employee_code, job_title, shift, department, active)
SELECT id, 'Operador Padrão', 'OP001', 'Operador de Câmera', 'Diurno', 'Produção', true
FROM public.users WHERE email = 'operador@empresa.com';

INSERT INTO public.profiles (user_id, display_name, employee_code, job_title, shift, department, active)
SELECT id, 'Gestor Padrão', 'GS001', 'Gestor de Qualidade', 'Administrativo', 'Qualidade', true
FROM public.users WHERE email = 'gestor@empresa.com';

-- ============================================================
-- 9. ATRIBUIR ROLES
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'operador'::app_role FROM public.users WHERE email = 'operador@empresa.com';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'gestor'::app_role FROM public.users WHERE email = 'gestor@empresa.com';

-- ============================================================
-- 10. CRIAR CONFIGURAÇÕES PADRÃO DO OPERADOR
-- ============================================================
INSERT INTO public.operator_configurations (
  user_id,
  delta_e,
  sample_points,
  sample_area_width_percent,
  reference_color_hex,
  reference_color_r,
  reference_color_g,
  reference_color_b,
  delta_configured,
  analysis_area_configured,
  color_configured,
  light_calibrated,
  system_step,
  active_view
)
SELECT 
  id,
  3,
  9,
  60,
  '#FFFFFF',
  255,
  255,
  255,
  false,
  false,
  false,
  false,
  'CONFIG',
  'MAIN'
FROM public.users WHERE email = 'operador@empresa.com';

-- ============================================================
-- 11. DADOS DE REFERÊNCIA (Análises Exemplo)
-- ============================================================
-- Inserir algumas análises de exemplo (comentado)
-- INSERT INTO public.analysis_records (
--   operator_user_id, reference_code, tissue_type, tissue_batch_code,
--   result, processing_time_ms, delta_e_measured, delta_e_threshold,
--   precision_percent, required_precision_percent,
--   reference_color_hex, measured_color_hex, analysis_type
-- )
-- SELECT 
--   id, 'REF-001', 'Algodão', 'BATCH-2026-07-001',
--   'ok', 150, 1.5, 2, 95.5, 90.0,
--   '#FFFFFF', '#FEFEFE', 'tecido'::analysis_item_type
-- FROM public.users WHERE email = 'operador@empresa.com';

-- ============================================================
-- 12. SENHAS PADRÃO (Referência)
-- ============================================================
-- operador@empresa.com: operador123
-- gestor@empresa.com: gestor123
--
-- Os hashes foram gerados com scrypt (algoritmo seguro)
-- Formato: salt.derivedkey
