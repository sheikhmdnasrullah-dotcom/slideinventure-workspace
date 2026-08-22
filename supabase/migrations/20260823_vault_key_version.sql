-- Secret vault: add key_version for key rotation support

alter table public.secret_vault_entries 
  add column if not exists key_version integer not null default 1;

create index if not exists secret_vault_entries_key_version_idx 
  on public.secret_vault_entries (key_version);
