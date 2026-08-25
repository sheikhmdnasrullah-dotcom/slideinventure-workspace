-- Boards table for the Brainstorm Sketch (tldraw) feature

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  title text,
  content jsonb not null default '{}'::jsonb,
  user_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_user_email_idx on public.boards (user_email);
create index if not exists boards_created_at_idx on public.boards (created_at desc);

alter table public.boards enable row level security;

create policy "Service role can manage boards"
  on public.boards for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Authenticated users can read their own boards"
  on public.boards for select
  using (auth.role() = 'authenticated');

-- Ensure the documents storage bucket exists (PDF uploads)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  true,
  52428800,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']
)
on conflict (id) do nothing;
