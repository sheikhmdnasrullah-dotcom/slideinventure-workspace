-- task_runs: every backend execution, script run, research job, or automation
-- triggered from the dashboard or externally.

create table if not exists public.task_runs (
  id text primary key,
  task_type text not null,
  status text not null,
  command text,
  output text,
  exit_code integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  triggered_by text,
  knowledge_item_id text references public.knowledge_items(id) on delete set null,
  metadata jsonb
);

create index if not exists task_runs_status_idx on public.task_runs (status);
create index if not exists task_runs_task_type_idx on public.task_runs (task_type);
create index if not exists task_runs_started_at_idx on public.task_runs (started_at desc);

alter table public.task_runs enable row level security;

create policy "Service role can manage task_runs"
  on public.task_runs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
