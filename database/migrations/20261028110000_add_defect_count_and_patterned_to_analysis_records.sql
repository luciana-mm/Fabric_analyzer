-- Adiciona contagem de defeitos físicos (defect_count) e flag de tecido detalhado/estampado (is_patterned)
-- na tabela analysis_records para suportar relatórios detalhados do Anomalib e OpenCV.

ALTER TABLE public.analysis_records
  ADD COLUMN IF NOT EXISTS defect_count INTEGER NOT NULL DEFAULT 0 CHECK (defect_count >= 0),
  ADD COLUMN IF NOT EXISTS is_patterned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_analysis_is_patterned ON public.analysis_records(is_patterned);
