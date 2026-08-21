-- Exact/fuzzy lexical search: paragraph-sized chunks with offsets, plus
-- persistent search history. Chunks are derived data rebuilt on every
-- knowledge_items write (see lib/knowledge/reindex.ts) — never a second
-- source of truth for content.

create extension if not exists pg_trgm;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id text not null references public.knowledge_items(id) on delete cascade,
  chunk_index int not null,
  heading text,
  text text not null,
  start_offset int not null,
  end_offset int not null,
  search_vector tsvector generated always as (to_tsvector('english', text)) stored,
  created_at timestamptz not null default now()
);

create unique index if not exists knowledge_chunks_item_chunk_idx
  on public.knowledge_chunks (knowledge_item_id, chunk_index);
create index if not exists knowledge_chunks_fts_idx
  on public.knowledge_chunks using gin (search_vector);
create index if not exists knowledge_chunks_trgm_idx
  on public.knowledge_chunks using gin (text gin_trgm_ops);

alter table public.knowledge_chunks enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'knowledge_chunks'
      and policyname = 'Service role manages knowledge_chunks'
  ) then
    create policy "Service role manages knowledge_chunks"
      on public.knowledge_chunks
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create table if not exists public.knowledge_search_history (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  query text not null,
  mode text not null default 'exact',
  result_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_search_history_user_idx
  on public.knowledge_search_history (user_email, created_at desc);

alter table public.knowledge_search_history enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'knowledge_search_history'
      and policyname = 'Service role manages knowledge_search_history'
  ) then
    create policy "Service role manages knowledge_search_history"
      on public.knowledge_search_history
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
