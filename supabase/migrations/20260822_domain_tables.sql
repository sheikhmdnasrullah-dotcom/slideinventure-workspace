-- Additional tables for the 20-domain backend architecture

-- Custom lead fields (distinct from the generic custom_fields jsonb)
create table if not exists public.custom_lead_fields (
  id text primary key default gen_random_uuid()::text,
  key text not null,
  label text not null,
  type text not null default 'text',
  options text[] default '{}',
  required boolean not null default false,
  visible boolean not null default true,
  sortable boolean not null default true,
  filterable boolean not null default false,
  width integer,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_lead_fields_key_idx on public.custom_lead_fields (key);

-- Imported files registry
create table if not exists public.imported_files (
  id text primary key default gen_random_uuid()::text,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  storage_path text,
  url text,
  mapping jsonb default '{}'::jsonb,
  row_count integer,
  imported_count integer default 0,
  error_count integer default 0,
  status text not null default 'pending',
  errors text[] default '{}',
  imported_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists imported_files_status_idx on public.imported_files (status);
create index if not exists imported_files_created_at_idx on public.imported_files (created_at desc);

-- Useful links
create table if not exists public.useful_links (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  url text not null,
  description text,
  tags text[] default '{}',
  favicon text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists useful_links_title_idx on public.useful_links (title);
create index if not exists useful_links_tags_idx on public.useful_links (tags);

-- Apps registry
create table if not exists public.apps (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  url text,
  category text,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apps_slug_idx on public.apps (slug);

-- Integrations
create table if not exists public.integrations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  provider text not null,
  type text not null,
  status text not null default 'inactive',
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integrations_provider_idx on public.integrations (provider);
create index if not exists integrations_status_idx on public.integrations (status);

-- Email drafts
create table if not exists public.email_drafts (
  id text primary key default gen_random_uuid()::text,
  account_id text not null,
  to text[] not null default '{}',
  cc text[] default '{}',
  bcc text[] default '{}',
  subject text,
  body text,
  reply_to_message_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_drafts_account_id_idx on public.email_drafts (account_id);

-- Email attachments
create table if not exists public.email_attachments (
  id text primary key default gen_random_uuid()::text,
  email_id text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  content_id text,
  disposition text,
  download_url text,
  created_at timestamptz not null default now()
);

create index if not exists email_attachments_email_id_idx on public.email_attachments (email_id);

-- Miro activity
create table if not exists public.miro_activity (
  id text primary key default gen_random_uuid()::text,
  event_type text not null,
  board_id text,
  card_id text,
  user_id text,
  user_name text,
  action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists miro_activity_event_type_idx on public.miro_activity (event_type);
create index if not exists miro_activity_created_at_idx on public.miro_activity (created_at desc);

-- Notion activity
create table if not exists public.notion_activity (
  id text primary key default gen_random_uuid()::text,
  event_type text not null,
  page_id text,
  block_id text,
  user_id text,
  user_name text,
  action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notion_activity_event_type_idx on public.notion_activity (event_type);
create index if not exists notion_activity_created_at_idx on public.notion_activity (created_at desc);

-- Todoist tasks
create table if not exists public.todoist_tasks (
  id text primary key default gen_random_uuid()::text,
  external_id text,
  project_id text,
  content text not null,
  description text,
  priority integer not null default 1,
  due_date timestamptz,
  completed boolean not null default false,
  assignee text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists todoist_tasks_completed_idx on public.todoist_tasks (completed);
create index if not exists todoist_tasks_project_id_idx on public.todoist_tasks (project_id);

-- Terminal commands
create table if not exists public.terminal_commands (
  id text primary key default gen_random_uuid()::text,
  command text not null,
  cwd text,
  exit_code integer,
  stdout text,
  stderr text,
  duration_ms bigint,
  triggered_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists terminal_commands_created_at_idx on public.terminal_commands (created_at desc);

-- Secret vault entries
create table if not exists public.secret_vault_entries (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  category text,
  encrypted_value text not null,
  iv text not null,
  tag text,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists secret_vault_entries_name_idx on public.secret_vault_entries (name);
create index if not exists secret_vault_entries_category_idx on public.secret_vault_entries (category);

-- Audit logs
create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  table_name text not null,
  record_id text not null,
  action text not null,
  diff jsonb,
  metadata jsonb,
  actor_email text,
  actor_id text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_table_name_idx on public.audit_logs (table_name);
create index if not exists audit_logs_record_id_idx on public.audit_logs (record_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_email_idx on public.audit_logs (actor_email);

-- RLS
alter table public.custom_lead_fields enable row level security;
alter table public.imported_files enable row level security;
alter table public.useful_links enable row level security;
alter table public.apps enable row level security;
alter table public.integrations enable row level security;
alter table public.email_drafts enable row level security;
alter table public.email_attachments enable row level security;
alter table public.miro_activity enable row level security;
alter table public.notion_activity enable row level security;
alter table public.todoist_tasks enable row level security;
alter table public.terminal_commands enable row level security;
alter table public.secret_vault_entries enable row level security;
alter table public.audit_logs enable row level security;

-- Service role policies
create policy "Service role can manage custom_lead_fields"
  on public.custom_lead_fields for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage imported_files"
  on public.imported_files for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage useful_links"
  on public.useful_links for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage apps"
  on public.apps for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage integrations"
  on public.integrations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage email_drafts"
  on public.email_drafts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage email_attachments"
  on public.email_attachments for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage miro_activity"
  on public.miro_activity for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage notion_activity"
  on public.notion_activity for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage todoist_tasks"
  on public.todoist_tasks for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage terminal_commands"
  on public.terminal_commands for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage secret_vault_entries"
  on public.secret_vault_entries for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage audit_logs"
  on public.audit_logs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Optional: authenticated read access for audit logs
create policy "Authenticated users can read audit_logs"
  on public.audit_logs for select
  using (auth.role() = 'authenticated');
