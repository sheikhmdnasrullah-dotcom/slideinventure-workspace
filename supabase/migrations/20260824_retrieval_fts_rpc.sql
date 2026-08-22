-- Retrieval fast-path: parameterized FTS search RPCs per source table.
-- Each accepts a tsquery string (already formatted with :* for prefix matching)
-- and returns ranked matches with a normalized rank score.

-- knowledge_chunks
create or replace function match_knowledge_chunks_fts(
  query_tsquery text,
  match_count int default 5
)
returns table (
  id uuid,
  knowledge_item_id text,
  chunk_index int,
  heading text,
  text text,
  start_offset int,
  end_offset int,
  rank float8
)
language sql
security definer
as $$
  select
    id,
    knowledge_item_id,
    chunk_index,
    heading,
    text,
    start_offset,
    end_offset,
    ts_rank(search_vector, to_tsquery('english', query_tsquery)) as rank
  from public.knowledge_chunks
  where search_vector @@ to_tsquery('english', query_tsquery)
  order by rank desc
  limit match_count;
$$;

-- leads
create or replace function search_leads_fts(
  query_tsquery text,
  match_count int default 10
)
returns table (
  id text,
  first_name text,
  last_name text,
  email text,
  company text,
  job_title text,
  notes text,
  rank float8
)
language sql
security definer
as $$
  select
    id,
    first_name,
    last_name,
    email,
    company,
    job_title,
    notes,
    ts_rank(search_vector, to_tsquery('english', query_tsquery)) as rank
  from public.leads
  where search_vector @@ to_tsquery('english', query_tsquery)
  order by rank desc
  limit match_count;
$$;

-- terminal_commands
create or replace function search_terminal_commands_fts(
  query_tsquery text,
  match_count int default 10
)
returns table (
  id text,
  command text,
  cwd text,
  exit_code int,
  stdout text,
  stderr text,
  created_at timestamptz,
  rank float8
)
language sql
security definer
as $$
  select
    id,
    command,
    cwd,
    exit_code,
    stdout,
    stderr,
    created_at,
    ts_rank(search_vector, to_tsquery('english', query_tsquery)) as rank
  from public.terminal_commands
  where search_vector @@ to_tsquery('english', query_tsquery)
  order by rank desc
  limit match_count;
$$;

-- apps
create or replace function search_apps_fts(
  query_tsquery text,
  match_count int default 10
)
returns table (
  id text,
  name text,
  description text,
  url text,
  category text,
  rank float8
)
language sql
security definer
as $$
  select
    id,
    name,
    description,
    url,
    category,
    ts_rank(search_vector, to_tsquery('english', query_tsquery)) as rank
  from public.apps
  where search_vector @@ to_tsquery('english', query_tsquery)
  order by rank desc
  limit match_count;
$$;

-- useful_links
create or replace function search_useful_links_fts(
  query_tsquery text,
  match_count int default 10
)
returns table (
  id text,
  title text,
  url text,
  description text,
  tags text[],
  rank float8
)
language sql
security definer
as $$
  select
    id,
    title,
    url,
    description,
    tags,
    ts_rank(search_vector, to_tsquery('english', query_tsquery)) as rank
  from public.useful_links
  where search_vector @@ to_tsquery('english', query_tsquery)
  order by rank desc
  limit match_count;
$$;
