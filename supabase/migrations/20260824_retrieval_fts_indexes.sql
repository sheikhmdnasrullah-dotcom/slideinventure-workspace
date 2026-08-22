-- Add full-text search and trigram indexes for retrieval fast-path sources

create extension if not exists pg_trgm;

-- leads: searchable fields
alter table public.leads
  add column if not exists search_vector tsvector
    generated always as (
      to_tsvector('english', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(company,'') || ' ' || coalesce(job_title,'') || ' ' || coalesce(notes,''))
    ) stored;

create index if not exists leads_fts_idx
  on public.leads using gin (search_vector);
create index if not exists leads_trgm_idx
  on public.leads using gin ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);

-- terminal_commands: searchable fields
alter table public.terminal_commands
  add column if not exists search_vector tsvector
    generated always as (
      to_tsvector('english', coalesce(command,'') || ' ' || coalesce(stdout,'') || ' ' || coalesce(stderr,'') || ' ' || coalesce(cwd,''))
    ) stored;

create index if not exists terminal_commands_fts_idx
  on public.terminal_commands using gin (search_vector);
create index if not exists terminal_commands_trgm_idx
  on public.terminal_commands using gin (command gin_trgm_ops);

-- apps: searchable fields
alter table public.apps
  add column if not exists search_vector tsvector
    generated always as (
      to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,''))
    ) stored;

create index if not exists apps_fts_idx
  on public.apps using gin (search_vector);
create index if not exists apps_trgm_idx
  on public.apps using gin (name gin_trgm_ops);

-- useful_links: searchable fields
alter table public.useful_links
  add column if not exists search_vector tsvector
    generated always as (
      to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(url,''))
    ) stored;

create index if not exists useful_links_fts_idx
  on public.useful_links using gin (search_vector);
create index if not exists useful_links_trgm_idx
  on public.useful_links using gin (title gin_trgm_ops);
