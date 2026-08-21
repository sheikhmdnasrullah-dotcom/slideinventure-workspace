-- knowledge_item_versions: snapshot of a knowledge_items row taken
-- immediately before it's overwritten, so AI or human edits never silently
-- destroy prior state. Append-only, never updated.

create table if not exists public.knowledge_item_versions (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id text not null references public.knowledge_items(id) on delete cascade,
  snapshot jsonb not null,
  changed_by text,
  change_source text not null,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_item_versions_item_idx
  on public.knowledge_item_versions (knowledge_item_id, created_at desc);

alter table public.knowledge_item_versions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'knowledge_item_versions'
      and policyname = 'Service role can manage knowledge_item_versions'
  ) then
    create policy "Service role can manage knowledge_item_versions"
      on public.knowledge_item_versions
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
