-- leads enhancements: custom fields and column configuration

alter table public.leads add column if not exists custom_fields jsonb default '{}'::jsonb;

create table if not exists public.lead_column_configs (
  id text primary key,
  user_id text not null,
  columns jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_column_configs_user_id_idx on public.lead_column_configs (user_id);
