# Security

Single-founder internal tool, not multi-tenant. The trust model reflects
that: authentication is the perimeter, and past it, a logged-in user (in
practice, one person) has broad power by design. Documented here so that
stays a conscious decision, not an accident.

## Auth model

- Supabase Auth, email/password only. No public signup surface — users are
  created directly in Supabase.
- `proxy.ts` only refreshes the session cookie; it does not gate routes.
  Every protected page/route calls `requireUser()` (redirects to `/login`)
  or `getSessionUser()` (returns 401 JSON) from `lib/supabase/server.ts`.
  **When adding a new page or route, you must add this check yourself** —
  there is no route-level middleware doing it for you.
- Machine callers (n8n, terminal/CLI scripts) don't get a session. They use
  `Authorization: Bearer <INTERNAL_API_SECRET>`, checked with
  `timingSafeEqual` in `lib/auth/verify-internal-secret.ts`. Routes gated
  this way: `knowledge/sync`, `knowledge/publish`, `webhooks/n8n`.

## Per-route auth (current state)

| Route | Auth |
|---|---|
| `api/dashboard` | session (`getSessionUser`) |
| `api/knowledge/search` | session — was unauthenticated until this hardening pass |
| `api/knowledge/ingest` | session — was unauthenticated until this hardening pass |
| `api/knowledge/publish` | internal secret |
| `api/knowledge/sync` | internal secret |
| `api/tasks` (GET) | session |
| `api/tasks/execute` (POST) | session |
| `api/webhooks/n8n` | internal secret |
| `strategy/actions.ts` (server actions) | session (`requireUser`) |

## Known trust decisions (deliberate, not gaps)

- **`api/tasks/execute` runs arbitrary shell commands.** Any authenticated
  session can POST a `task_type: "script"` command and it gets `spawn(cmd,
  { shell: true })`'d on the server (`lib/tasks/runner.ts`). This is a
  feature (it's the "Claude Code as controlled operator" execution surface),
  not an oversight — but it means **login = full server control**. There is
  no command allowlist, no sandboxing, no per-user permission tier. If a
  second human account is ever added, this route needs scoping before that
  happens, not after.
- **RLS is coarse.** Most tables are service-role-only (app routes use
  `createServiceClient()` and enforce auth themselves in code, not via RLS).
  The one exception is `task_runs`, which also grants `authenticated` SELECT
  (`supabase/migrations/20260821_task_runs_realtime.sql`) — required because
  Supabase Realtime enforces RLS using the *subscribing client's* role
  (browser anon/authenticated key), not `service_role`. That policy is
  read-only; writes to `task_runs` still go through service-role app code.
- **Self-hosted Supabase, one shared VPS.** No network isolation between the
  mail server, the DB, and both Next.js apps beyond Caddy routing. Compromise
  of one component has a wide blast radius. Documented in
  `knowledge/system/infrastructure-setup.md`, not re-litigated here.

## Fixed in this hardening pass

- `api/knowledge/search` and `api/knowledge/ingest` were reachable
  unauthenticated on the public deployment, backed by the service-role
  client (full read/write bypassing RLS). Both now require a session.
- `api/knowledge/search` built a PostgREST `.or()` filter by interpolating
  the raw query string. A value containing `,`, `(`, `)`, or `"` could break
  out of the intended field list and alter the filter logic (PostgREST
  filter injection — not SQL injection, but the same class of bug: untrusted
  input parsed as query syntax instead of a value). Fixed by escaping `\`
  and `"` and capping query length to 200 chars before interpolation.

## Secrets

`.env.local`, never committed: `SUPABASE_SERVICE_ROLE_KEY` (full DB access,
bypasses RLS — server-only), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe client-side),
`INTERNAL_API_SECRET`, `ANTHROPIC_API_KEY`. If any of these leak, rotate in
Supabase Studio / the relevant provider dashboard, not just in `.env.local`.

## Not implemented (known gap, not yet a problem at current scale)

- No RBAC — there's one trust level (logged in / not).
- No prompt-injection guardrails on content that flows into Claude Code
  context (e.g. knowledge file bodies, task output). At single-founder scale
  with founder-authored content this is a low-probability risk; revisit if
  ingestion ever accepts untrusted third-party text (e.g. scraped web
  content, inbound email bodies) as knowledge input.
- No rate limiting on any route.
