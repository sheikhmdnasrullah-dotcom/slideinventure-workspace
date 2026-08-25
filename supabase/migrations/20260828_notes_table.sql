-- Notes table for the Notepad feature

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text,
  content jsonb not null default '[]'::jsonb,
  user_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_email_idx on public.notes (user_email);
create index if not exists notes_created_at_idx on public.notes (created_at desc);

alter table public.notes enable row level security;

create policy "Service role can manage notes"
  on public.notes for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Optional: authenticated users can read their own notes
create policy "Authenticated users can read their own notes"
  on public.notes for select
  using (auth.role() = 'authenticated');
