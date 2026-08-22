-- Mail message cache
-- Stores fetched IMAP messages so the UI loads fast and supports DB-side search.
-- Source of truth is always the mail server; this is a read-through cache.

create table if not exists mail_messages (
  id            text primary key,          -- "{uid}@{folder}"
  uid           integer not null,
  folder        text    not null,
  "from"        text    not null,
  from_name     text    not null default '',
  "to"          text[]  not null default '{}',
  cc            text[]  not null default '{}',
  subject       text    not null default '',
  body_text     text    not null default '',
  body_html     text,
  sent_at       timestamptz not null,
  is_read       boolean not null default false,
  has_attachments boolean not null default false,
  message_id    text,
  in_reply_to   text,
  labels        text[]  not null default '{}',
  fetched_at    timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists mail_messages_folder_sent_at on mail_messages (folder, sent_at desc);
create index if not exists mail_messages_is_read on mail_messages (is_read);
create index if not exists mail_messages_fetched_at on mail_messages (fetched_at desc);

-- Full-text search vector
alter table mail_messages
  add column if not exists fts tsvector
    generated always as (
      to_tsvector('english',
        coalesce(subject, '') || ' ' ||
        coalesce(body_text, '') || ' ' ||
        coalesce(from_name, '') || ' ' ||
        coalesce("from", '')
      )
    ) stored;

create index if not exists mail_messages_fts on mail_messages using gin(fts);

-- Enable RLS (users see all messages — single-user app)
alter table mail_messages enable row level security;

create policy "authenticated users can read mail"
  on mail_messages for select
  using (auth.role() = 'authenticated');

create policy "service role full access"
  on mail_messages for all
  using (true)
  with check (true);
