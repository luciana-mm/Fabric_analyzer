-- EMERGENCY ROLLBACK ONLY. Do not run this file automatically.
-- Prerequisites:
--   1. auth.users exists and contains every ID in public.users.
--   2. Supabase Auth is again the chosen identity provider.
-- This restores Supabase-dependent foreign keys, RLS and policies. It does not
-- copy password hashes or create auth.users records.
begin;

do $$
begin
  if to_regclass('auth.users') is null then
    raise exception 'Rollback requires auth.users to exist.';
  end if;
  if exists (
    select 1 from public.users u
    where not exists (select 1 from auth.users a where a.id = u.id)
  ) then
    raise exception 'Rollback requires every public.users ID to exist in auth.users.';
  end if;
end
$$;

drop trigger if exists update_users_updated_at on public.users;

alter table public.profiles
  drop constraint if exists profiles_user_id_fkey,
  add constraint profiles_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_roles
  drop constraint if exists user_roles_user_id_fkey,
  add constraint user_roles_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.operator_configurations
  drop constraint if exists operator_configurations_user_id_fkey,
  add constraint operator_configurations_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.analysis_records
  drop constraint if exists analysis_records_operator_user_id_fkey,
  add constraint analysis_records_operator_user_id_fkey
    foreign key (operator_user_id) references auth.users(id) on delete cascade;

create or replace function public.is_manager(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role::text = 'gestor'
  )
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.get_current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid() limit 1
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _role public.app_role;
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  _role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'operador'::public.app_role);
  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.operator_configurations enable row level security;
alter table public.analysis_records enable row level security;

create policy "Users and managers can view profiles" on public.profiles for select to authenticated using (auth.uid() = user_id or (select public.is_manager(auth.uid())));
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can insert their own profile" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "Users and managers can view roles" on public.user_roles for select to authenticated using (auth.uid() = user_id or (select public.is_manager(auth.uid())));
create policy "Users and managers can view analyses" on public.analysis_records for select to authenticated using (operator_user_id = auth.uid() or (select public.is_manager(auth.uid())));
create policy "Users can insert their own analyses" on public.analysis_records for insert to authenticated with check (operator_user_id = auth.uid() or (select public.is_manager(auth.uid())));
create policy "Users can view own configuration" on public.operator_configurations for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own configuration" on public.operator_configurations for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own configuration" on public.operator_configurations for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;
