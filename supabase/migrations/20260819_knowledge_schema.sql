-- knowledge_items, entities, relations: previously undocumented tables that
-- already exist in the live Supabase project. This migration brings them
-- under version control without disrupting existing data:
--   - `create table if not exists` is a no-op where the table already exists.
--   - `add column if not exists` backfills any column this migration expects
--     but the live table predates.
--   - RLS policies are (re)created via DO blocks since CREATE POLICY has no
--     IF NOT EXISTS form.
--
-- Status taxonomy (documented, not DB-enforced — real data already contains
-- values like 'active'/'in_progress' from before this taxonomy existed):
--   confirmed | researched | ai_inferred | proposed | conflicting | deprecated
-- Per CLAUDE.md, only the founder may write status: confirmed.

create extension if not exists pgcrypto;

create table if not exists public.knowledge_items (
  id text primary key,
  type text not null,
  title text not null,
  slug text not null,
  content_path text,
  content_type text,
  body text,
  status text not null default 'proposed',
  source text,
  author text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_items add column if not exists content_type text;
alter table public.knowledge_items add column if not exists created_at timestamptz not null default now();
alter table public.knowledge_items add column if not exists updated_at timestamptz not null default now();

create unique index if not exists knowledge_items_slug_idx on public.knowledge_items (slug);
create index if not exists knowledge_items_type_idx on public.knowledge_items (type);
create index if not exists knowledge_items_status_idx on public.knowledge_items (status);
create index if not exists knowledge_items_updated_at_idx on public.knowledge_items (updated_at desc);

alter table public.knowledge_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'knowledge_items'
      and policyname = 'Service role can manage knowledge_items'
  ) then
    create policy "Service role can manage knowledge_items"
      on public.knowledge_items
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create table if not exists public.entities (
  id text primary key,
  type text not null,
  name text not null
);

alter table public.entities enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'entities'
      and policyname = 'Service role can manage entities'
  ) then
    create policy "Service role can manage entities"
      on public.entities
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create table if not exists public.relations (
  id uuid primary key default gen_random_uuid(),
  from_entity_id text not null references public.entities(id) on delete cascade,
  to_entity_id text not null references public.entities(id) on delete cascade,
  relation_type text not null,
  source_knowledge_item_id text references public.knowledge_items(id) on delete set null
);

create unique index if not exists relations_dedupe_idx
  on public.relations (from_entity_id, to_entity_id, relation_type, source_knowledge_item_id);
create index if not exists relations_from_idx on public.relations (from_entity_id);
create index if not exists relations_to_idx on public.relations (to_entity_id);

alter table public.relations enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'relations'
      and policyname = 'Service role can manage relations'
  ) then
    create policy "Service role can manage relations"
      on public.relations
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
