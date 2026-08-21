-- documents: PDF uploads for the workspace dashboard

create table if not exists public.documents (
  id text primary key,
  title text not null,
  filename text not null,
  mime_type text not null default 'application/pdf',
  size_bytes integer not null,
  storage_path text not null,
  url text,
  tags text[],
  status text not null default 'active',
  author text,
  source text not null default 'dashboard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_created_at_idx on public.documents (created_at desc);
create index if not exists documents_tags_idx on public.documents (tags);

alter table public.documents enable row level security;

create policy "Service role can manage documents"
  on public.documents
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
