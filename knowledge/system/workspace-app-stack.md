---
id: system-2026-08-18-001
type: system
title: workspace-app — stack, auth architecture, env vars
tags: [nextjs, supabase, auth, infra]
status: ai_inferred
source: workspace-app engineering session, 2026-08-17/18
author: Tanim
created_at: 2026-08-18
---

## Stack

- Next.js 16.3.1 (App Router, Turbopack). `middleware.js` is deprecated in
  this version — renamed `proxy.js`. See `AGENTS.md` for the standing note
  to read `node_modules/next/dist/docs/` before writing framework code.
- Supabase: Postgres + Auth. `@supabase/ssr` for cookie-based sessions
  (not the deprecated `auth-helpers` package), `@supabase/supabase-js` for
  the service-role admin client.
- Deploy target: `workspace.slideinventure.com` (subdomain of the main
  SlideIn Venture marketing site).

## Auth architecture

| File | Purpose |
|---|---|
| `lib/supabase/client.ts` | Browser client, anon key, for Client Components |
| `lib/supabase/server.ts` | `createClient()` — session-aware, cookie-based, for Server Components/Actions. `createServiceClient()` — service-role, RLS-bypassing, admin only. Guarded with `server-only`. |
| `lib/supabase/middleware.ts` | `updateSession()` — refreshes the auth cookie against Supabase, called from proxy |
| `proxy.ts` | Root-level, runs `updateSession` on every request except static assets |
| `app/login/page.tsx` | Client component, email+password via `signInWithPassword` |
| `app/workspace/page.tsx` | Server component, redirects to `/login` if `getUser()` returns no user |

Auth flow: login page sets a session cookie via the browser client → proxy
refreshes it on every subsequent request → server components read it via
`lib/supabase/server.ts`'s `createClient()`.

## Env vars (`.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL` — full project URL (`https://<ref>.supabase.co`),
  not the bare project ref
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser + session-aware server client
- `SUPABASE_SERVICE_ROLE_KEY` — admin client only, never exposed to the browser

## Known-good verification path

`npx tsx --env-file=.env.local scripts/test-connection.ts` — connects with
the service-role client and does a `select count(*)` against a real table
to confirm credentials and network path before trusting anything higher up
the stack.
