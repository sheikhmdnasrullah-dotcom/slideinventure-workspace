-- Enable Supabase Realtime on task_runs and allow logged-in users to read it
-- directly (needed because Realtime enforces RLS using the subscribing
-- client's role — the anon/authenticated browser client, not service_role).
-- This is a single-workspace internal console; any authenticated user may
-- read execution history (writes remain service-role only, unchanged).

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'task_runs'
      and policyname = 'Authenticated users can read task_runs'
  ) then
    create policy "Authenticated users can read task_runs"
      on public.task_runs
      for select
      using (auth.role() = 'authenticated');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_runs'
  ) then
    alter publication supabase_realtime add table public.task_runs;
  end if;
end $$;
