-- Operator-scoped persisted system configuration.
create table if not exists public.operator_configurations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  delta_e smallint not null default 3 check (delta_e in (1, 2, 3)),
  sample_points smallint not null default 9 check (sample_points in (4, 9, 18)),
  sample_area_width_percent numeric(5,2) not null default 60 check (sample_area_width_percent >= 0 and sample_area_width_percent <= 100),
  sample_area_height_percent numeric(5,2) not null default 50 check (sample_area_height_percent >= 0 and sample_area_height_percent <= 100),
  reference_color_hex text not null default '#ffffff' check (reference_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  reference_color_r smallint not null default 255 check (reference_color_r >= 0 and reference_color_r <= 255),
  reference_color_g smallint not null default 255 check (reference_color_g >= 0 and reference_color_g <= 255),
  reference_color_b smallint not null default 255 check (reference_color_b >= 0 and reference_color_b <= 255),
  delta_configured boolean not null default false,
  analysis_area_configured boolean not null default false,
  color_configured boolean not null default false,
  light_calibrated boolean not null default false,
  active_view text not null default 'home' check (active_view in ('home', 'analysis', 'capture', 'delta', 'ambient')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operator_configurations_user_id_idx
  on public.operator_configurations (user_id);

alter table public.operator_configurations enable row level security;

create policy "Users can view own configuration"
  on public.operator_configurations
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own configuration"
  on public.operator_configurations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own configuration"
  on public.operator_configurations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy by design.

drop trigger if exists update_operator_configurations_updated_at on public.operator_configurations;
create trigger update_operator_configurations_updated_at
before update on public.operator_configurations
for each row execute function public.update_updated_at_column();
