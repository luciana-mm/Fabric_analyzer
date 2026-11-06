-- Store detailed color comparison metrics for operator analysis history.
alter table public.analysis_records
  add column if not exists delta_e_measured numeric(8,4),
  add column if not exists delta_e_threshold smallint check (delta_e_threshold in (1, 2, 3)),
  add column if not exists precision_percent numeric(5,2) check (precision_percent >= 0 and precision_percent <= 100),
  add column if not exists required_precision_percent numeric(5,2) check (required_precision_percent >= 0 and required_precision_percent <= 100),
  add column if not exists comparison_method text default 'CIEDE2000',
  add column if not exists reference_color_hex text check (reference_color_hex is null or reference_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists measured_color_hex text check (measured_color_hex is null or measured_color_hex ~ '^#[0-9A-Fa-f]{6}$');

create index if not exists analysis_records_analyzed_at_idx
  on public.analysis_records (analyzed_at desc);
