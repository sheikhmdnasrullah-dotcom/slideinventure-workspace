# Engineering Decisions

ADR-style log for this codebase's architecture. Not to be confused with
`knowledge/decisions/*.md`, which is business decisions (source-of-truth
knowledge items with frontmatter, synced to the DB). This file is for "why
does the code work this way" — plain markdown, git history is its versioning.

## Files are source of truth; DB is a synced index

**Decision**: `knowledge/*.md` and `SecondBrain/*.md` are canonical.
`knowledge_items` is rebuilt from them by `lib/knowledge/sync.ts` and is
never hand-edited to diverge from a file that still exists.
**Why**: files are diffable, git-tracked, and readable/writable by both
Claude Code and a human editor without touching infra. A DB-only model would
make "what did this knowledge item say last week" a query instead of a
`git log`, and would make Claude Code's writes opaque.
**Trade-off accepted**: no reconciliation for deletes (removing a `.md` file
doesn't remove its DB row), and sync is filesystem-dependent, which breaks
on Vercel — see ARCHITECTURE.md "Known gaps."

## Version snapshots over diffs

**Decision**: `recordVersion()` stores a full-row JSONB snapshot before every
update, not a computed diff.
**Why**: simplest thing that gives a real undo/audit trail. A diff format
would need a schema of its own and reconciliation logic to replay; a
snapshot is just "what did the row look like," queryable and restorable by
hand if needed.
**Trade-off accepted**: storage grows with every edit, no compaction. Fine
at current volume (single founder, markdown files); revisit if edit volume
grows enough that `knowledge_item_versions` size becomes a real cost.

## Idempotent migrations, applied manually

**Decision**: every migration file uses `create table if not exists`,
`add column if not exists`, and `DO $$ ... $$` blocks that check
`pg_policies`/`pg_publication_tables` before creating, so re-running a
migration against a DB that already has the change is a safe no-op.
**Why**: this Supabase instance is self-hosted with no CLI project link and
no reachable direct Postgres connection string from a dev machine — SQL is
run by hand through Supabase Studio's SQL editor. Idempotency is the
guardrail against "did I already run this" mistakes when there's no
migration-tracking tool enforcing order.
**Consequence**: Claude Code can write migration files but cannot apply them
in this environment — flagged explicitly each time rather than assumed done.

## Service-role auth in app code, not RLS, for most tables

**Decision**: API routes use `createServiceClient()` (bypasses RLS) and
enforce `getSessionUser()`/`verifyInternalSecret()` checks in the route
handler itself, rather than relying on fine-grained RLS policies per table.
**Why**: this is a single-trust-level internal tool — there's no need for
per-row access control between users, because there's effectively one user.
Doing auth in one place (`lib/supabase/server.ts`,
`lib/auth/verify-internal-secret.ts`) is easier to audit than RLS policies
scattered across every table.
**Exception**: `task_runs` also has an `authenticated`-role SELECT RLS
policy, because Supabase Realtime evaluates RLS using the subscribing
browser client's role, not service-role — the app-layer check doesn't apply
to a Realtime subscription. See SECURITY.md.
**Revisit when**: a second human account with a different trust level is
added — at that point this decision needs to change, not just get a patch.

## Realtime over polling, one table at a time

**Decision**: replaced `execution-panel.tsx`'s 5s poll with a Supabase
Realtime `postgres_changes` subscription on `task_runs`. The dashboard KPI
route's 10s poll was left as-is.
**Why**: `task_runs` is the highest-frequency-changing table and the one
where "5 seconds stale" is most visible (a running task). It's also the
table that already had a service-role RLS policy to extend, making it the
lowest-risk first Realtime target. Converting every poller in one pass would
have meant touching more RLS surface at once with less ability to verify
each change independently.
**Next candidate**: the dashboard KPI/chart poll, if 10s staleness becomes a
real complaint rather than a theoretical one.

## Deferred to V2, not built now

Prospect/company/campaign entity model, RBAC, vector/semantic search,
command palette, dedicated entity detail pages, Notion/Miro integration.
**Why**: the original spec asked for these, but none of them are needed to
make the four MVP fixes (dashboard real data, auth on knowledge routes,
version history, realtime) load-bearing. Building them speculatively ahead
of the entity graph actually having prospects in it would be scaffolding
with nothing to scaffold. Build when `knowledge/prospects/` has real content
driving a real need for structured queries over it.
