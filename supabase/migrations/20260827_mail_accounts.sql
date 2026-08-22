-- User-added mail accounts (beyond the env-configured Mailcow accounts)
-- Credentials stored encrypted via lib/vault/crypto.ts, same shape as secret_vault_entries.

create table if not exists public.mail_accounts (
  id                  text primary key default gen_random_uuid()::text,
  email               text not null unique,
  name                text not null,
  provider            text not null default 'imap_smtp', -- 'imap_smtp' | 'google' | 'microsoft'
  imap_host           text,
  imap_port           integer,
  smtp_host           text,
  smtp_port           integer,
  encrypted_password  text, -- combined iv:tag:ciphertext from lib/vault/crypto.ts
  created_by          text,
  created_at          timestamptz not null default now()
);

create index if not exists mail_accounts_provider_idx on public.mail_accounts (provider);

alter table public.mail_accounts enable row level security;

create policy "Service role can manage mail_accounts"
  on public.mail_accounts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
