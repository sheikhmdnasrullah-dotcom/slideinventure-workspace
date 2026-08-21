-- Semantic search: vector embeddings on top of Round 1's knowledge_chunks.
-- embedding is populated best-effort by lib/knowledge/reindex.ts after the
-- lexical chunk write — a failed/unset NVIDIA_API_KEY leaves it null and
-- search degrades to lexical-only, never a hard failure.

create extension if not exists vector;

alter table public.knowledge_chunks
  add column if not exists embedding vector(1024),
  add column if not exists embedded_at timestamptz;

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- PostgREST can't express `<=>` ordering directly, so semantic search goes
-- through this RPC. security invoker: runs as the calling (service) role,
-- same access as any other service-role query against this table.
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1024),
  match_count int,
  filter_item_ids text[] default null
)
returns table (
  id uuid,
  knowledge_item_id text,
  chunk_index int,
  heading text,
  text text,
  start_offset int,
  end_offset int,
  similarity float
)
language sql
stable
security invoker
as $$
  select
    c.id,
    c.knowledge_item_id,
    c.chunk_index,
    c.heading,
    c.text,
    c.start_offset,
    c.end_offset,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  where c.embedding is not null
    and (filter_item_ids is null or c.knowledge_item_id = any(filter_item_ids))
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
