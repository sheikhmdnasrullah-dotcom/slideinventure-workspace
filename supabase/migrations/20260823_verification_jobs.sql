-- verification_jobs: tracks email verification batch runs
-- Apply via Supabase Studio → SQL Editor

create table if not exists public.verification_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text not null default 'running',   -- running | completed | failed
  total_leads int,
  checked_count int not null default 0,
  verdict_counts jsonb not null default '{}',
  result_file_path text,
  error_message text,
  job_id text  -- matches the job_api job_id (filesystem key)
);

-- Indexes
create index if not exists verification_jobs_status_idx
  on public.verification_jobs (status);
create index if not exists verification_jobs_created_at_idx
  on public.verification_jobs (created_at desc);

-- Auto-update updated_at on row change
create or replace function public.set_verification_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists verification_jobs_set_updated_at on public.verification_jobs;
create trigger verification_jobs_set_updated_at
  before update on public.verification_jobs
  for each row execute function public.set_verification_updated_at();

-- RLS: enable and restrict
alter table public.verification_jobs enable row level security;

-- Authenticated dashboard user can read all jobs (single-user app)
drop policy if exists "Authenticated users can read verification jobs"
  on public.verification_jobs;
create policy "Authenticated users can read verification jobs"
  on public.verification_jobs
  for select
  using (auth.role() = 'authenticated');

-- Service role (VPS verify script, Next.js server actions) can do everything
drop policy if exists "Service role can manage verification jobs"
  on public.verification_jobs;
create policy "Service role can manage verification jobs"
  on public.verification_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Enable Realtime on this table
alter publication supabase_realtime add table public.verification_jobs;

-- PostgREST needs explicit GRANT on top of RLS policies
GRANT ALL ON public.verification_jobs TO service_role;
GRANT ALL ON public.verification_jobs TO authenticated;
