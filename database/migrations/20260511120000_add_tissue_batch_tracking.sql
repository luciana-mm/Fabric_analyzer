-- Track current tissue batch per operator configuration and analysis record.
alter table public.operator_configurations
  add column if not exists active_tissue_code text not null default 'TCD-LEGACY'
  check (char_length(trim(active_tissue_code)) > 0);

alter table public.analysis_records
  add column if not exists tissue_batch_code text;

create index if not exists analysis_records_tissue_batch_code_idx
  on public.analysis_records (tissue_batch_code);
