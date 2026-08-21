-- leads: CRM-style lead records for the workspace dashboard

create table if not exists public.leads (
  id text primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  company text,
  job_title text,
  phone text,
  source text not null default 'manual',
  status text not null default 'new',
  notes text,
  tags text[],
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_tags_idx on public.leads (tags);

alter table public.leads enable row level security;

create policy "Service role can manage leads"
  on public.leads
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
