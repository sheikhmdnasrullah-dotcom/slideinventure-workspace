-- Terminal commands enhancements: add title, description, category, tags, notes, variables, favorite, updated_at

alter table public.terminal_commands 
  add column if not exists title text not null default 'Untitled Command',
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists tags text[] default '{}',
  add column if not exists notes text,
  add column if not exists variables jsonb default '{}'::jsonb,
  add column if not exists favorite boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Backfill title from command for existing rows
update public.terminal_commands 
set title = command 
where title = 'Untitled Command' and command is not null and command != '';

create index if not exists terminal_commands_category_idx on public.terminal_commands (category);
create index if not exists terminal_commands_favorite_idx on public.terminal_commands (favorite);
create index if not exists terminal_commands_created_at_idx on public.terminal_commands (created_at desc);
