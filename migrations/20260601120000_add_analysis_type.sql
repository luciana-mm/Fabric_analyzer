-- Add analysis_type enum to track whether analysis is for tissue (tecido) or items (pecas)

do $$
begin
  create type public.analysis_item_type as enum ('tecido', 'pecas');
exception
  when duplicate_object then null;
end
$$;

alter table public.analysis_records
  add column if not exists analysis_type public.analysis_item_type not null default 'tecido';

-- Set existing records to 'tecido' by default (assumes all previous analyses were tissue)
update public.analysis_records
set analysis_type = 'tecido'
where analysis_type is null;

-- Create index for filtering by analysis type
create index if not exists analysis_records_analysis_type_idx
  on public.analysis_records (analysis_type);
