-- task_run_events: progress reporting for long-running agent tasks.
-- Each event captures a progress snapshot (current/total/current_item).
-- The latest event for a task_run_id gives the current progress bar state.
-- Consumed via Supabase Realtime for live "43/100" updates.

create table if not exists public.task_run_events (
  id uuid primary key default gen_random_uuid(),
  task_run_id uuid not null references public.task_runs(id) on delete cascade,
  sequence int not null, -- monotonically increasing per task_run
  current int not null default 0,
  total int not null default 0,
  current_item text,
  status text check (status in ('starting','running','completed','failed')) default 'running',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists task_run_events_run_seq_idx
  on public.task_run_events (task_run_id, sequence);

create index if not exists task_run_events_run_latest_idx
  on public.task_run_events (task_run_id, created_at desc);

alter table public.task_run_events enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'task_run_events'
      and policyname = 'Service role manages task_run_events'
  ) then
    create policy "Service role manages task_run_events"
      on public.task_run_events
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Latest progress view for easy Realtime subscription
create or replace view public.task_run_latest_progress as
select
  tre.task_run_id,
  tre.current,
  tre.total,
  tre.current_item,
  tre.status,
  tre.metadata,
  tre.created_at,
  tr.task_type,
  tr.command,
  tr.triggered_by
from public.task_run_events tre
join public.task_runs tr on tr.id = tre.task_run_id
where tre.sequence = (
  select max(sequence) from public.task_run_events tre2
  where tre2.task_run_id = tre.task_run_id
);