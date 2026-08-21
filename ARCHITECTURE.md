# Architecture

SlideIn Venture OS — internal ops console for a one-founder outreach business.
Single Next.js app talking directly to a self-hosted Supabase instance. No
separate backend service.

## Deployment topology

One Contabo VPS (`169.58.207.75`) runs everything behind Caddy:

| Domain | Backed by |
|---|---|
| `slideinventure.com` | marketing site (repo root, PM2 `website`, :3000) |
| `workspace.slideinventure.com` | this app (PM2 `workspace`, :3001) |
| `db.slideinventure.com` | self-hosted Supabase (Kong gateway, :8000) |
| `mail.nasrullahtanim.me` | Mailcow |

Full infra detail (DNS, mail, ports): `knowledge/system/infrastructure-setup.md`.
Vercel is also configured (`.vercel/`) as a secondary deploy target — see
`git log` for the deploy-workflow history; the VPS is the system of record
described in this doc.

## Two apps, one repo

- Repo root — marketing site.
- `workspace-app/` (this directory) — the ops console. Everything below is
  scoped to here.

Both are independent Next.js apps in one GitHub monorepo. They do not share
code or a build.

## Stack

- Next.js App Router, React 19, TypeScript strict.
- Tailwind v4 (CSS-first, no `tailwind.config.*`) + shadcn/ui (`base-nova`
  style, built on `@base-ui/react`, not Radix).
- Supabase: Postgres + Auth (email/password) + Storage + Realtime, self-hosted.
- `proxy.ts` (Next 16's renamed `middleware.ts`) only refreshes the session
  cookie — it does not gate routes. Every protected page calls `requireUser()`
  itself (see `lib/supabase/server.ts`).

## Directory map

```
app/
  (auth)/login/            public
  (app)/                   requireUser()-gated pages
    knowledge/             knowledge_items browser + PDF upload
    strategy/               decision/plan board (kanban-ish status flow)
    cold-outreach/          campaign UI
    automations/            n8n trigger UI
  api/
    dashboard/              dashboard KPI/chart/feed aggregation
    knowledge/{search,ingest,publish,sync}/   see SECURITY.md for auth per route
    tasks/{,execute}/       task_runs read + arbitrary command execution
    webhooks/n8n/           inbound automation events
    copilotkit/             CopilotKit + Anthropic runtime endpoint
lib/
  supabase/{client,server,middleware}.ts   the four Supabase client factories
  auth/verify-internal-secret.ts           Bearer-token check for machine callers
  knowledge/{sync,versioning}.ts           frontmatter → DB sync, version snapshots
  tasks/{runner,logger}.ts                 shell exec + task_runs bookkeeping
components/dashboard/                       execution-panel, charts, feed
supabase/migrations/                        hand-written idempotent SQL, applied
                                             manually via Supabase Studio SQL editor
knowledge/                                  markdown source of truth (see MEMORY.md)
SecondBrain/                                Obsidian vault, also synced
```

## Data flow

```
knowledge/*.md, SecondBrain/*.md
        │  (frontmatter + wikilinks)
        ▼
lib/knowledge/sync.ts  ──sync──▶  knowledge_items, entities, relations (Postgres)
                                          │
app dashboard pages / API routes ────────┤── read/write ──▶ Supabase (service-role
                                          │                  or session-scoped client)
task execution (shell / n8n webhook) ────┘── task_runs ──▶ Realtime channel
                                                              │
components/dashboard/execution-panel.tsx  ◀──postgres_changes┘
```

`npm run sync` (or `POST /api/knowledge/sync`, internal-secret gated) is the
only writer from files into the DB. The DB is never hand-edited to diverge
from a file that still exists — see `lib/knowledge/versioning.ts` and MEMORY.md.

## Known gaps (not yet built)

- **Vercel deploy breaks `syncKnowledge`**: it walks `knowledge/` and
  `SecondBrain/` off disk. Serverless functions on Vercel don't bundle
  arbitrary repo directories, so a sync triggered from a Vercel-hosted
  instance will silently no-op (empty file lists, not an error). The VPS
  deploy (PM2, full filesystem) is unaffected. Flagged, not fixed — sync
  should ultimately read from the DB or object storage, not local disk,
  if the Vercel target becomes primary.
- No reconciliation pass for deleted `.md` files — deleting a file locally
  does not delete its `knowledge_items` row.
- V2 (explicitly deferred, not started): prospect/company/campaign entity
  model beyond the generic `entities`/`relations` graph, RBAC, vector/semantic
  search, command palette, dedicated entity detail pages, Notion/Miro
  integrations.
