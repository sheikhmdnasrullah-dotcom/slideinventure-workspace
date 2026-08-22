-- Secret vault: add missing columns

alter table public.secret_vault_entries
  add column if not exists service_name text,
  add column if not exists username text,
  add column if not exists secret_type text not null default 'secret',
  add column if not exists url text,
  add column if not exists notes text,
  add column if not exists tags text[] not null default '{}';
