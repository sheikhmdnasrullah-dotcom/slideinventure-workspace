# Memory Model

How this system remembers things, and what's real today vs. what the
original spec described but isn't built.

## Source of truth

`/knowledge/*.md` (plus `/SecondBrain/*.md`, an Obsidian vault) is the
source of truth. The `knowledge_items` table is a synced index of those
files, not an independent store — see `CLAUDE.md`: "Never write directly to
the database." Every write path that touches `knowledge_items` other than
`lib/knowledge/sync.ts` (search UI ingest, terminal publish, strategy board)
exists because not everything originates as a file (e.g. board cards created
in the UI), but the rule holds in spirit: files win, DB reflects files.

## What's actually implemented

**Confidence / status**, not the full 6-state model from the original spec.
`knowledge_items.status` is one of `proposed | in_progress | confirmed |
deprecated` (see `STRATEGY_STATUSES` in `app/(app)/strategy/actions.ts`).
Per `CLAUDE.md`: only the founder marks something `confirmed` — Claude Code
may only write `proposed` or note something as AI-inferred in the body text.
There is no separate `AI_INFERRED`/`RESEARCHED`/`CONFLICTING` enum; if that
granularity is needed later, extend the `STRATEGY_STATUSES` list and the
check constraint together (`supabase/migrations/20260819_knowledge_schema.sql`
has no CHECK constraint on `status` currently — validation is app-layer only,
in `actions.ts`/`sync.ts`).

**Version history**: every update to a `knowledge_items` row is preceded by
a full-row JSONB snapshot into `knowledge_item_versions`
(`lib/knowledge/versioning.ts#recordVersion`), tagged with `change_source`
(`sync | ingest | publish | strategy-board`) and `changed_by`. This is the
actual "never silently destroy memory" guarantee — it's a snapshot trail, not
a diff/merge system. Nothing currently reads `knowledge_item_versions` back
out (no UI history view yet); the data is captured, the surface isn't built.

**Entity graph**: `entities` + `relations`, populated only from Obsidian
`[[wikilinks]]` in `SecondBrain/*.md` via `syncWikilinks()`. It is a link
graph, not the business-entity model (prospects/companies/campaigns) the
original spec describes — that's the deferred V2 item noted in
`ARCHITECTURE.md`. `knowledge/prospects/` exists as a directory with no files
in it yet, which is why the dashboard's `active-prospects` KPI is correctly 0.

**Event log**: `task_runs` is the closest thing to an event/activity layer —
every sync run, shell execution, and n8n webhook call lands a row there, and
`components/dashboard/execution-panel.tsx` now subscribes to it via Supabase
Realtime (see `supabase/migrations/20260821_task_runs_realtime.sql`) instead
of polling.

## What's not implemented

The original spec's 5-layer memory architecture (event / working / long-term
/ relational / provenance as distinct subsystems) is not built as separate
layers. What exists maps loosely as:

- event → `task_runs`
- long-term → `knowledge_items` (+ files)
- relational → `entities`/`relations`
- provenance → `knowledge_item_versions` + each row's `source`/`author` fields
- working memory → doesn't exist; there's no session/scratch layer between
  a Claude Code run and a committed knowledge file today.

No full-text index and no semantic/vector search — `app/api/knowledge/search`
is plain Postgres `ilike` on `title`/`body` plus array-contains on `tags`
(see SECURITY.md for why that route needed input escaping). No `tsvector`
column, no `pg_trgm`, no `pgvector` exist anywhere in the schema today —
correcting an earlier draft of this file that claimed otherwise. A search
returns whole matching rows, not passages within them; there's no chunking,
no offsets, no highlighting.

## Duplication rule

`CLAUDE.md` requires checking `/knowledge` before creating a new item.
`lib/knowledge/sync.ts` enforces uniqueness at the DB layer (`seenIds` map,
duplicate `id` → `failed`), but does not do fuzzy/semantic duplicate
detection — that check is a Claude Code process discipline, not code.
