-- Real dashboard data model for TissueScope.
-- This migration is idempotent and can run safely in existing projects.

-- Ensure role enum exists for compatibility with existing auth logic.
do $$
begin
  create type public.app_role as enum ('operador', 'gestor');
exception
  when duplicate_object then null;
end
$$;

-- Extend profile fields used by manager dashboard.
alter table public.profiles
  add column if not exists employee_code text,
  add column if not exists shift text,
  add column if not exists job_title text,
  add column if not exists department text,
  add column if not exists active boolean not null default true;

-- Create analysis records table used by operator and manager dashboards.
create table if not exists public.analysis_records (
  id uuid not null default gen_random_uuid() primary key,
  operator_user_id uuid not null references auth.users (id) on delete cascade,
  reference_code text not null unique,
  tissue_type text not null,
  result text not null check (result in ('ok', 'fail')),
  failure_reason text,
  processing_time_ms integer not null check (processing_time_ms > 0),
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists analysis_records_operator_user_id_analyzed_at_idx
  on public.analysis_records (operator_user_id, analyzed_at desc);

create index if not exists analysis_records_result_idx
  on public.analysis_records (result);

-- Keep RLS enabled in exposed schema.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.analysis_records enable row level security;

-- Manager helper for simple policy checks.
create or replace function public.is_manager(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id and role::text = 'gestor'
  )
$$;

-- Replace profile policies.
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users and managers can view profiles" on public.profiles;

create policy "Users and managers can view profiles"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or (select public.is_manager(auth.uid()))
  );

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Replace user_roles select policy.
drop policy if exists "Users can view their own roles" on public.user_roles;
drop policy if exists "Users and managers can view roles" on public.user_roles;

create policy "Users and managers can view roles"
  on public.user_roles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or (select public.is_manager(auth.uid()))
  );

-- Policies for analysis records.
drop policy if exists "Users can view own analyses" on public.analysis_records;
drop policy if exists "Users and managers can view analyses" on public.analysis_records;
drop policy if exists "Users can insert own analyses" on public.analysis_records;
drop policy if exists "Users can insert their own analyses" on public.analysis_records;

create policy "Users and managers can view analyses"
  on public.analysis_records
  for select
  to authenticated
  using (
    operator_user_id = auth.uid()
    or (select public.is_manager(auth.uid()))
  );

create policy "Users can insert their own analyses"
  on public.analysis_records
  for insert
  to authenticated
  with check (
    operator_user_id = auth.uid()
    or (select public.is_manager(auth.uid()))
  );
