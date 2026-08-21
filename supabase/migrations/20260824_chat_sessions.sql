-- Chat sessions + messages: persistent conversation history for the RAG chat.
-- Each message stores its evidence chunks (knowledge_chunk IDs + offsets) so
-- citations can be reconstructed and deep-linked to /knowledge/[slug]?q=&chunk=.

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_idx
  on public.chat_sessions (user_email, updated_at desc);

alter table public.chat_sessions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_sessions'
      and policyname = 'Service role manages chat_sessions'
  ) then
    create policy "Service role manages chat_sessions"
      on public.chat_sessions
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  -- Evidence chunks that support this assistant message. Each entry:
  -- { chunk_id, knowledge_item_id, chunk_index, heading, text, start_offset, end_offset, similarity }
  evidence jsonb not null default '[]',
  -- For user messages: optional filters passed to the RAG pipeline
  filters jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx
  on public.chat_messages (session_id, created_at);

alter table public.chat_messages enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_messages'
      and policyname = 'Service role manages chat_messages'
  ) then
    create policy "Service role manages chat_messages"
      on public.chat_messages
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Auto-update chat_sessions.updated_at on new message
create or replace function public.touch_chat_session()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.chat_sessions
    set updated_at = now()
    where id = new.session_id;
  return new;
end $$;

drop trigger if exists touch_chat_session on public.chat_messages;
create trigger touch_chat_session
  after insert on public.chat_messages
  for each row execute function public.touch_chat_session();