-- working_memory: short-lived scratch space between agent runs and founder commits.
-- Each entry is a tentative fact/observation that hasn't been promoted to
-- knowledge_items yet. TTL-based cleanup prevents unbounded growth.

create table if not exists public.working_memory (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  content text not null,
  source text, -- e.g., "agent:research", "cli:note", "web:scrape"
  context jsonb not null default '{}', -- arbitrary structured context
  expires_at timestamptz not null, -- TTL for automatic cleanup
  created_at timestamptz not null default now(),
  promoted_to_knowledge_item_id text references public.knowledge_items(id) on delete set null
);

create index if not exists working_memory_user_expires_idx
  on public.working_memory (user_email, expires_at);

create index if not exists working_memory_promoted_idx
  on public.working_memory (promoted_to_knowledge_item_id);

alter table public.working_memory enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'working_memory'
      and policyname = 'Service role manages working_memory'
  ) then
    create policy "Service role manages working_memory"
      on public.working_memory
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Extend entities with business types (beyond Obsidian wikilinks)
alter table public.entities
  add column if not exists entity_type text check (entity_type in ('company','person','project','campaign','deal','document','tag'));

alter table public.entities
  add column if not exists properties jsonb not null default '{}';

alter table public.entities
  add column if not exists source text; -- "wikilink" | "classifier" | "manual" | "import"

-- Extend relations with typed relation kinds
alter table public.relations
  add column if not exists relation_type text check (relation_type in (
    'works_at', 'owns', 'manages', 'partner_of', 'competitor_of',
    'parent_of', 'child_of', 'references', 'depends_on', 'blocks',
    'mentions', 'cites', 'contradicts', 'supports', 'custom'
  ));

-- Index for relation traversal
create index if not exists relations_type_idx on public.relations (relation_type);
create index if not exists entities_type_idx on public.entities (entity_type);