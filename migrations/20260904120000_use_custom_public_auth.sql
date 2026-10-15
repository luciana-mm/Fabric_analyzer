-- Consolidate the application on its server-managed authentication model.
-- This migration deliberately stops if Supabase Auth contains users, because
-- its password hashes are incompatible with the application's scrypt verifier.
begin;

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) not null unique,
  password_hash varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  auth_users_have_records boolean;
begin
  if to_regclass('auth.users') is not null then
    execute 'select exists (select 1 from auth.users)' into auth_users_have_records;
  end if;

  if coalesce(auth_users_have_records, false) then
    raise exception
      'auth.users contains records. Do not migrate password hashes automatically; provision matching public.users accounts through the controlled migration/runbook first.';
  end if;
end
$$;

-- Remove all policies before dropping their helpers. RLS is not part of the
-- custom-auth model: authorization is enforced by the server API.
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users and managers can view profiles" on public.profiles;

drop policy if exists "Users can view their own roles" on public.user_roles;
drop policy if exists "Users and managers can view roles" on public.user_roles;

drop policy if exists "Users can view own analyses" on public.analysis_records;
drop policy if exists "Users and managers can view analyses" on public.analysis_records;
drop policy if exists "Users can insert own analyses" on public.analysis_records;
drop policy if exists "Users can insert their own analyses" on public.analysis_records;

drop policy if exists "Users can view own configuration" on public.operator_configurations;
drop policy if exists "Users can insert own configuration" on public.operator_configurations;
drop policy if exists "Users can update own configuration" on public.operator_configurations;

alter table public.profiles disable row level security;
alter table public.user_roles disable row level security;
alter table public.operator_configurations disable row level security;
alter table public.analysis_records disable row level security;

-- The signup trigger depends on handle_new_user, so remove it first.
do $$
begin
  if to_regclass('auth.users') is not null then
    execute 'drop trigger if exists on_auth_user_created on auth.users';
  end if;
end
$$;

drop function if exists public.get_current_user_role();
drop function if exists public.handle_new_user();
drop function if exists public.has_role(uuid, public.app_role);
drop function if exists public.is_manager(uuid);

alter table public.profiles
  drop constraint if exists profiles_user_id_fkey,
  add constraint profiles_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade;

alter table public.user_roles
  drop constraint if exists user_roles_user_id_fkey,
  add constraint user_roles_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade;

alter table public.operator_configurations
  drop constraint if exists operator_configurations_user_id_fkey,
  add constraint operator_configurations_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade;

alter table public.analysis_records
  drop constraint if exists analysis_records_operator_user_id_fkey,
  add constraint analysis_records_operator_user_id_fkey
    foreign key (operator_user_id) references public.users(id) on delete cascade;

drop trigger if exists update_users_updated_at on public.users;
create trigger update_users_updated_at
before update on public.users
for each row execute function public.update_updated_at_column();

commit;
