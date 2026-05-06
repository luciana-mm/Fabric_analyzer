alter table public.operator_configurations
  add column if not exists system_step text not null default 'CONFIG'
  check (system_step in ('CONFIG', 'LIGHT', 'READY'));

update public.operator_configurations
set
  system_step = 'CONFIG',
  delta_configured = false,
  analysis_area_configured = false,
  color_configured = false,
  light_calibrated = false;
