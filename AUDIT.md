# SlideIn Venture OS — Reconnaissance & Design Audit

Reconnaissance only. No application code was modified. This document is the
Phase 0–1 deliverable described in the project brief: audit the existing
repository and the reference template's design discipline, then propose the
architecture for the AI-native Venture OS. **Awaiting approval before any
implementation.**

A critical finding up front: this repository is **not** a blank
`shadcn-dashboard-landing-template`. Substantial SlideIn Venture product
work has already shipped (Vue of commits `b37ad2a`, `f31c6c5`), including
auth, a knowledge system, lexical search with chunking + offsets, realtime
task runs, and a design-token scaffold. The audit is therefore primarily an
**assessment of what exists** against the brief's quality bar, not a clean-
sheet plan.

---

## CURRENT ARCHITECTURE

### Identity

- Repo root: `/Users/nasrullahtanim/Projects/slidein-venture` (git origin:
  `sheikhmdnasrullah-dotcom/slidein-venture`). Monorepo with **two** Next.js
  apps:
  - Repo root — marketing site (PM2 `website`, :3000, `slideinventure.com`).
  - `workspace-app/` — **this** ops console (PM2 `workspace`, :3001,
    `workspace.slideinventure.com`). Vercel configured as secondary deploy
    (`.vercel/`).
- Working tree is clean on `main`, up to date with origin.
- Self-hosted Supabase on one Contabo VPS (`169.58.207.75`) behind Caddy;
  `db.slideinventure.com` (Kong :8000). See `ARCHITECTURE.md`,
  `knowledge/system/infrastructure-setup.md`.

### Stack

- Next.js **16.3.1** App Router, React **19.2.8**, TS strict. The AGENTS.md
  block warns this is a breaking Next.js (`proxy.ts` instead of
  `middleware.ts`; `LayoutProps<>`/`PageProps<>` typed route helpers). Confirmed
  real: `proxy.ts`, `app/(app)/knowledge/[slug]/page.tsx` uses
  `PageProps<"/knowledge/[slug]">` and `await props.params`.
- Tailwind **v4** (CSS-first via `@import "tailwindcss"`, no JS config) +
  shadcn/ui **`base-nova`** style built on **`@base-ui/react`** (not Radix).
- Supabase JS for Auth (email/password), Postgres, Storage, Realtime.
  `@supabase/ssr`.
- `framer-motion` (motion), `recharts` (charts), `sonner` (toasts),
  `lucide-react` (icons), `next-themes` (installed, unused in layout),
  `gray-matter` (frontmatter), `pdf-parse` (PDF — not yet wired), `tw-animate-css`.
- Scripts: `dev`, `build`, `start`, `lint`, `sync`, `sync:watch`, `task`.
  No `typecheck` / `test`. No ESLint custom rules beyond `eslint-config-next`.

### Directory map (workspace-app)

```
app/
  (auth)/login/                 public login
  (app)/                        requireUser()-gated
    layout.tsx                  SidebarProvider + AppSidebar + Toaster + KnowledgeChatWidget
    page.tsx                    Dashboard (DashboardContent)
    knowledge/                   browser + [slug] detail
    strategy/                    decision/plan board (server actions)
    cold-outreach/               campaign placeholder
    automations/                 n8n trigger placeholder
  api/
    dashboard/                   KPI/chart/feed aggregation (session)
    knowledge/{search,search-history,ingest,publish,sync}/
    tasks/{,execute}/            task_runs read + arbitrary shell exec
    webhooks/n8n/                inbound (internal secret)
components/
  ui/[avatar,badge,breadcrumb,button,card,chart,collapsible,dropdown-menu,
      field,input,label,separator,sheet,sidebar,skeleton,sonner,table,tabs,
      textarea,tooltip].tsx       20 shadcn primitives
  dashboard/[app-sidebar,site-header,nav-user,dashboard-content,kpi-card,
             outreach-chart,activity-table,execution-panel,research-panel,
             cold-email-panel,coming-soon].tsx
  knowledge/[search-panel,knowledge-chat-widget,exact-search-results,
             highlighted-body,highlight,animated-section].tsx
  login-form.tsx
hooks/use-mobile.ts
lib/
  supabase/{client,server,middleware}.ts
  auth/verify-internal-secret.ts
  knowledge/{sync,versioning,chunking,reindex}.ts
  tasks/{runner,logger}.ts
  dashboard/types.ts
  utils.ts (cn)
supabase/migrations/   5 idempotent hand-applied SQL files
knowledge/             markdown source of truth (8 files: decisions, research,
                       sops, system)
SecondBrain/           Obsidian vault (synced, wikilinks → entity graph)
scripts/               sync-knowledge, sync-watch, task, test-connection
skills/knowledge-management/SKILL.md
```

### Data model (Postgres)

- `knowledge_items` (text PK `id`, type, title, slug unique, content_path,
  content_type, body, status, source, author, tags[], timestamps). Status is
  a free text column — taxonomy `proposed|in_progress|confirmed|deprecated`
  enforced only in app (`strategy/actions.ts`); the migration comment lists an
  un-enforced 6-state.
- `knowledge_chunks` (FK → items, chunk_index, heading, text, offsets,
  `search_vector` tsvector generated column, GIN tsvector + GIN trigram).
  Derived, rebuilt on every write (`reindex.ts`). This is the
  **passage-level retrieval** layer the brief calls for — already exists.
- `knowledge_item_versions` (full-row JSONB snapshot, change_source, changed_by).
  Written on every update; **no UI reads it yet** (history view not built).
- `knowledge_search_history` (user_email, query, mode, result_count).
- `entities` + `relations` (wikilink graph only — not the business entity
  model; prospects/companies/campaigns are deferred).
- `task_runs` (id uuid, task_type, status, command, output, exit_code,
  triggered_by, metadata, timestamps). Has `authenticated` SELECT RLS for
  Realtime.
- **No** `pgvector`. No embeddings. No semantic/向量 layer. No reranker.

### Data flow

```
knowledge/*.md + SecondBrain/*.md  (frontmatter + wikilinks)
  → lib/knowledge/sync.ts (gray-matter parse, chunk via chunkBody)
  → knowledge_items upsert + reindexChunks + recordVersion + entity graph
dashboard / API routes read Supabase (service-role) → JSON / SSR
task execution: dashboard shell exec OR CLI npm run task
  → task_runs row → Supabase Realtime postgres_changes → execution-panel
```

Known & documented gaps (ARCHITECTURE.md, MEMORY.md, DECISIONS.md, SECURITY.md):
Vercel deploy breaks disk-based sync; no delete reconciliation; semantic/vector
+ reranker + entity model + RBAC + command palette + version-history UI
deferred to "V2"; login = full server control (arbitrary shell exec); no
prompt-injection guardrails on ingested content; no rate limiting.

### Design tokens (app/globals.css)

Tailwind v4 `@theme inline` mapping CSS vars → Tailwind color utilities.
Root defines a single **light-only** palette in OKLCH: neutral grays
(`--background` 1 → `--foreground` 0.145, `--muted` 0.97, `--muted-foreground`
0.556), `--border`/`--input` 0.922, `--ring` 0.708, chart-1..5 as grayscale
ramp, `--radius` 0.625rem with derived sm/md/lg/xl/2xl/3xl/4xl. Brand system:
`--brand` `oklch(0.691 0.207 42.28)` (orange), `--signal` 0.563 (darker
orange for text-on-light passes contrast), `--brand-soft` 8% alpha. Sidebar
tokens mirror the neutral set. Fonts: Geist Sans + Geist Mono via `next/font`.
**No dark theme tokens defined** (`@custom-variant dark` exists but `:root.dark`
block is absent — `next-themes` is installed but not wired into layout).
System prompt references a richer domain item encoder. The `day` class is
hardcoded on `<html>`.

---

## DESIGN AUDIT

### Reference vs. reality

The brief points at `shadcn-dashboard-landing-template` as the design-quality
benchmark. The actual repository is the **marketing template's sibling app
already rebadged as SlideIn Venture**, plus a sibling design-system doc
(`../design-system.md`) describing the *marketing site's* sophisticated tone
system (`Section tone="base|raised|anchor|terminal"`, two-axis theme/tone
contract, `--surface`/`--on-surface`/`--faint`/`--accent-vs-natural`, Fraunces
+ Switzer + mono three-level type, `cubic-bezier(0.16,1,0.3,1)` motion).
That marketing design system is **not** carried into `workspace-app/`:
workspace-app uses default Geist + neutral shadcn tokens + a single brand
orange. So the workspace console is currently **the weakest-designed surface
in the monorepo** — it reads as default-shadcn, which is exactly the "generic
SaaS template" look the brief says to avoid.

### 1. Global structure

- Sidebar: shadcn `Sidebar collapsible="icon"`, ~default width (~16rem expanded,
  ~3rem icon-rail). 3 groups (Overview / Operations / Workspace), 5 items
  total. Active state via `pathname === url` — **does not highlight index
  children** (e.g. `/knowledge/x` will not keep "Knowledge Base" active
  because it's exact-match).
- Top header `h-14` with `border-border/60`, `SidebarTrigger`, vertical
  separator, breadcrumb (single static page title), date chip (hard-coded "Aug
  1 – Aug 18, 2026"), optional Sync button. Compact and disciplined.
- Content: `p-4 md:p-6`, `flex flex-col gap-6`. No explicit max-width — full
  bleed. Page header is a 2-line muted uppercase eyebrow + count; no
  `PageHeader` primitive (each page hand-rolls).
- Grid: KPIs `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, then chart full,
  then `lg:grid-cols-2` for two panels, then full-width panels. Coherent but
  the rhythm is "stack of cards", not the band/section rhythm the marketing
  design system mandates.

### 2. Typography

- Single family Geist (sans + mono). Hierarchy by size/weight only:
  - Page eyebrow: `text-sm font-medium tracking-wide uppercase` tinted
    `text-foreground/60` — small for an eyebrow, fights with the brief's
    "labels too loud" risk by being a quasi-heading.
  - KPI value: `font-mono text-3xl font-semibold tabular-nums tracking-tight` —
    good, the strongest typographic moment on the page.
  - Card title: default shadcn `CardTitle` (text-base font-semibold).
  - Body/muted: `text-sm text-muted-foreground`, micro-copy in `text-xs`.
- No role classes, no display face, no label-face distinction. Everything is
  sans. Mono is used ad hoc for numbers and the command terminal. This is the
  biggest gap vs. the reference design philosophy.

### 3. Surfaces

- All containers are `Card` (white, default `rounded-6xl`-ish, `border-border`,
  soft shadcn shadow) — the brief explicitly warns against **over-carding**;
  the current dashboard puts literally every block in a Card.
- `--[card-spacing:1.5rem]` override on KPI/activity/chart cards — a spacing
  knob, used inconsistently.
- Borders use `border-border` and `border-foreground/10` interchangeably;
  `/10` `/30` `/40` `/60` alpha-mod opacity tiers are scattered through
  components rather than tokenized (e.g.
  `border-foreground/10`, `text-foreground/40`, `border-brand/30`).
- Dividers: one `Separator` in the header. No `Section`/`Surface`/`Rule`
  primitives — everything is a card.
- Hover/selected: limited. Cards have no hover. Table rows have shadcn default
  hover. Status badges are well-made (`STATUS_STYLES` map in activity-table).

### 4. Information density

Currently sparse by design (small data volume) but the structure does not
scale: a single vertical stack of full-width cards collapses to one card per
viewport row on laptop, which the brief calls out asdashboard cliché. The
strongest density moment is `ActivityTable` (sortable headers, mono dates,
status + type badges, source) — that is the pattern to extend. The execution
panel's inline black output terminal is a nice moment of density inside
chrome.

### 5. Navigation

- One level deep. No secondary nav, no command palette, no global search
  trigger (the floating "Knowledge search" FAB is the de-facto global search,
  but it calls the old items-mode search and returns whole rows, not passages).
- Collapse to icon-rail on desktop; on mobile the shadcn sidebar becomes a
  sheet — standard shadcn behavior, not bespoke.
- `KnowledgeChatWidget` is a 384px floating right-bottom panel — a floating
  widget, the exact thing the brief says to avoid ("arbitrary floating
  widgets"). It duplicates the search panel's role without using the chunk
  index.

### 6. Interaction

- Motion: framer-motion used in 3 spots — KPI stagger reveal (0.3s easeOut
  w/ 0.05s delay), sync spinner rotate, range-toggle fade on the chart. All
  subtle. No `prefers-reduced-motion` guard despite design-system.md requiring
  it. No spring/interruptible motion.
- Loading: page-level `DashboardSkeleton` (box skeletons mirroring layout).
  No per-card skeletons, no skeleton-shimmer variant.
- Empty states: plain `<p>` muted text ("No knowledge items yet..."). No
  `EmptyState` primitive, no illustration/CTA.
- Error states: try/catch silently degrade to empty data — no `ErrorState`,
  no retry affordance.
- Search debounce 500ms (panel) / 400ms (widget) — duplicated logic, two
  different timings.

### 7. Responsiveness

- `sm`/`lg`/`xl` breakpoints drive grid col counts only. No bespoke tablet
  transformation. Tables (only `ActivityTable`) rely on shadcn default
  horizontal scroll. The FAB widget is fixed-position and would overlap
  content on mobile. No full-screen command/search experience.

### Accessibility

- Semantic HTML largely via shadcn primitives. `aria-label`s present on icon
  buttons (close FAB etc.). Keyboard: Escape closes widget (manually bound);
  no global ⌘K binding. **No focus-trap**, no `prefers-reduced-motion` media
  query handling. Color contrast on the orange: `signal` 0.563 on white is
  the legible one (good — they chose the darker one for text); but ad-hoc
  `text-foreground/40` at small sizes likely dips below AA once composited.
  No contrast verification script in workspace-app (the marketing side has
  `scripts/verify-contrast.mjs`).

### What's genuinely good (preserve)

- **Constraint**: muted neutral palette, one brand color, mono numerals.
  Visually restrained — the opposite of "AI gradient soup".
- **Evidence-first search skeleton**: chunking with offsets, tsvector +
  trigram fallback, exact mode returning passages with "Open source →" deep
  links and `?q=&chunk=` scroll-to-source. This is the brief's target search
  design, ~80% built.
- **Status/trend token language**: `STATUS_STYLES` + `TREND_STYLES` maps are
  a clean, reusable pattern that could be promoted to design tokens.
- **ActivityTable**: the density reference for the rest of the app.
- **Realtime on task_runs**: the right first table; incremental, verifiable.
- **Architecture documentation**: ARCHITECTURE/DECISIONS/MEMORY/SECURITY are
  excellent — the project has discipline the design lacks.

---

## WHAT SHOULD BE PRESERVED

1. The **files-are-source-of-truth** model (`knowledge/*.md` + frontmatter) —
   do not migrate wholesale to DB-only. The brief's adaptive ingestion can
   layer on top, but markdown remains the provenance root.
2. `sync.ts` / `reindex.ts` / `chunking.ts` — the chunk index is correct and
   must underpin both exact and semantic search.
3. `task_runs` + Realtime as the activity/event backbone and the agent
   execution surface.
4. The service-role-auth-in-app + per-route `requireUser()`/`verifyInternalSecret()`
   model (until a second trust tier appears).
5. Idempotent migration discipline.
6. The KPI `tabular-nums` mono-value pattern.
7. ARCHITECTURE/DECISIONS/MEMORY/SECURITY as living docs.

## WHAT SHOULD BE REBUILT / INTRODUCED

Below is the proposed plan. None of it has been started; all awaits approval.

---

## PROPOSED INFORMATION ARCHITECTURE

A console, not a menu. The IA must answer the brief's six questions (what's
happening / what do we know / what changed / what did AI discover / what needs
attention / what next) without a 20-item sidebar.

### Sidebar — 4 groups, ≤10 leaves

```
Command
  Command Center          /                 (home)
  Activity               /activity         (event log with filters)

Work
  Knowledge              /knowledge        (browser + adaptive render)
  Prospects              /prospects        (entity list — when data lands)
  Outreach               /campaigns        (campaigns + email threads)
  Strategy               /strategy         (decisions + plans kanban)

Intelligence
  Research               /research         (agent research outputs)
  Insights               /insights         (AI-discovered, citable)
  Agents                 /agents           (running + history, task_runs view)

System
  Integrations           /integrations     (n8n, Supabase, NVIDIA config)
  Settings               /settings
```

Progressive disclosure: collapsible icon-rail persists; group labels replace
the random "Overview/Operations/Workspace" labels. Active state moves to
`segment` matching (`/knowledge/x` keeps "Knowledge" active). A **⌘K command
menu** is the primary global navigator (it is missing today) — see Search.

### Command Center (home) — not a KPI wall

Reframe the four existing KPIs away from "Emails Sent / Active Prospects /
Knowledge Items / Task Runs" (analytics-cliché) into the brief's framing:

- A single **"What changed since you were last here"** rail (chunks/items
  newly synced, task_runs completed, decisions adopted) — one
  chronological evidence list, not four numbers.
- A **Needs attention** strip: items in `proposed` awaiting the founder's
  `confirmed`, failed task_runs, conflicting knowledge.
- A **Live agents** micro-panel (running `task_runs`, progress if
  metadata.counters present).
- One small **Outreach velocity** sparkline (the only graph).
- **Activity table** (existing) as the dense tail.

KPI cards survive but become a 4-up *status* row (not a 4-up *metric* wall):
each is a label + value + provenance subline + a trend that links into a
filtered view. No giant hero numbers.

---

## PROPOSED DESIGN SYSTEM

Align workspace-app with the marketing side's design discipline (design-
system.md) but adapted for a **dense operating console** rather than a
marketing page. Concrete token file: `app/styles/*.css` (new).

### Tokens (resolve the current ad-hoc alpha scattering)

- Promote the `*-/{n}` opacity hack to **named tiers**: `--rule`
  (hairline), `--rule-strong`, `--muted` (4.5:1 text), `--faint` (icons/disabled
  only — never text), `--text-on-surface`, `--text-strong`. Reuse the marketing
  contract names (`--surface`, `--surface-2`, `--accent`, `--accent-vivid`,
  `--accent-wash`, `--accent-ring`, `--on-accent`).
- Add the **theme axis** (`day`/`night`) that is currently declared but
  un-defined. Wire `next-themes` (already installed) into root layout; add
  `:root.dark` (or `.night`) token block. **No `dark:` utility variants** —
  inherit from `--surface`-style tokens, exactly as design-system.md mandates.
- Keep single brand orange at hue 42.28; keep `--signal` as the
  text-legible variant; forbid `--brand` (the vivid one) on type except above
  24px on dark — encode as a lint rule + comment.
- Radius: keep `--radius 0.625rem` base but **reduce card radius** to
  `--radius-md` (0.5rem) and reserve `--radius-lg+` for dialogs/sheets. The
  current 6xl cards read as soft SaaS.
- Spacing token: define `--space-1..12` on a 4px base; today's `gap-4/6`, `p-4/6`,
  `--[card-spacing:1.5rem]` are fine but un-systematized.

### Typography (three faces, role classes)

| Role | Face | Use |
|---|---|---|
| Display (optional) | keep Geist for now (no display face in deps) — OR add Fraunces to match marketing; **decision pending** | Hero/section titles only |
| UI/body | Geist Sans (existing) | Everything else |
| Technical/labels | Geist Mono (existing) | Labels, dates, IDs, coordinates |

Introduce role utility classes (`.text-eyebrow`, `.text-label`, `.text-meta`,
`.text-value`) so components consume roles, not `text-xs text-foreground/40`.
This also makes the marketing contrast-test script portable here.

### Primitives (replace "everything is a Card")

Build a small primitive layer in `components/ui/` (genuine primitives, not
for count's sake — each replaces a current hand-rolled pattern):

- `<Section tone>` + `<SectionRule>` — the band/section contract from
  design-system.md, adapted to console layout (used in Command Center +
  detail pages). `tone: base | inset | anchor`.
- `<Surface>` — the non-card container (flat section on inset well),
  replaces ~half of the current `<Card>` usages.
- `<PageHeader eyebrow title meta actions />` — replaces per-page hand-rolled
  muted-uppercase header.
- `<Metric value label delta provenance />` — replaces `KpiCard` with a
  token-driven provenance line.
- `<DataTable>` (wrap shadcn table + sortable header + empty/loading/error
  states) — generalizes `ActivityTable`.
- `<StatusBadge>` (tokenized, fold `STATUS_STYLES` + `TREND_STYLES` in),
  `<EmptyState>`, `<LoadingState>`, `<ErrorState>`, `<Timeline>`,
  `<DetailPanel>`, `<FilterBar>`, `<SourceCitation>`, `<EvidenceBlock>`,
  `<EntityCard>`, `<ActivityResult>`.
- `<CommandMenu>` (⌘K) — see Search.
- Keep `<Card>` for genuinely raised containers only (push the brief's
  "over-card" rule).

### Motion

- Adopt `cubic-bezier(0.16, 1, 0.3, 1)` as the only easing (replace
  `easeOut`/`linear` literals).
- Wrap every motion in `useReducedMotion` guards (framer-motion supports it
  natively; add a `Motion` wrapper that no-ops under reduced-motion).
- KPI stagger: keep but drop duration to 0.2s. Remove the FAB widget's
  float-animated entrance.

---

## PROPOSED ADAPTIVE CONTENT SYSTEM

The brief's central conceptual feature. The repo already has the seed
(`content_type` column on `knowledge_items`, today always null-ish; `type`
field in frontmatter). Proposal:

### Classification pipeline (server-side only, no frontend codegen)

```
ARTIFACT (upload / agent output / import / research)
  → Classifier (NVIDIA LLM or rule + MIME) assigns `content_type`
     from a fixed enum: TEXT | DOCUMENT | IMAGE | PDF | SPREADSHEET |
     CSV | LINK | WEB_RESEARCH | CLAUDE_SESSION | AGENT_EXECUTION |
     LEAD | COMPANY | PERSON | CLIENT | CAMPAIGN | EMAIL | INSIGHT |
     DECISION | SOP | TASK | PROJECT | MEETING | SOURCE | UNKNOWN
  → Structure extractor (per content_type): columns? headings? entities? OCR?
  → Entity linker (writes entities/relations — extend beyond wikilinks)
  → Store as knowledge_items (body = normalized markdown || JSON) +
     content_type + metadata JSONB
  → Renderer picks an EXISTING UI schema keyed by content_type
```

### Render registry, not codegen

- `lib/content/registry.ts` maps `content_type → <SchemaRenderer>`. Each
  renderer is a hand-built React component composed from primitives
  (`DataTable` for CSV/leads, `EvidenceBlock` for research, `SourceCitation`
  for web, `PDFViewer` stub for PDF, `ImageMeta` for images). **The LLM never
  emits JSX.** It only emits classification + extracted metadata JSON, which
  is validated against a per-type Zod schema before it can populate a row.
- New schema proposal flow: when classifier confidence is low or no
  renderer matches, it returns `UNKNOWN` → renders a generic `DocumentView` +
  an "AI proposes new content type" review card (creator-only). The schema is
  committed to the registry by a human edit, never by runtime codegen. This
  satisfies the brief's "adapt without uncontrolled frontend code".

### CSV → Prospects worked example

`upload data.csv` → classifier sees MIME text/csv + headers →
`content_type = CSV` → extractor infers prospect fields (email, company,
role) → `content_type` re-promoted to `LEAD`-dataset with `metadata.columns`
→ `ProspectTable` renderer (built on `DataTable`) renders it on the
Prospects page. No "CSV uploaded" card on the dashboard.

### Storage

Markdown stays the canonical home for prose artifacts (research, SOPs,
decisions). Binary/structured artifacts (CSV, PDF, images) live in
Supabase Storage; `knowledge_items.content_path` points at the object; the
chunk index runs on the extracted text body. `pdf-parse` is already a
dependency, unused — wire it into the PDF extractor.

---

## PROPOSED MEMORY ARCHITECTURE

Extend the existing well-documented mapping (MEMORY.md) into the brief's
five layers, reusing existing tables where they already fit:

| Layer | Store (existing → proposed) |
|---|---|
| Event | `task_runs` → keep; add `task_runs.metadata` conventions for progress (43/100). |
| Working | **new** `working_memory` table (session-scoped scratch: a Claude Code run's in-flight notes before commit). Short TTL, forked to `knowledge_items` on `publish`. |
| Long-term | `knowledge_items` + `knowledge_chunks` + files. Keep. |
| Relational | `entities` + `relations` → extend population beyond Obsidian wikilinks to classifier-extracted entities. Add typed relations (PROSPECT_OF, OWNS, WORKS_AT) via `relation_type`. |
| Provenance | `knowledge_item_versions` (snapshots) + `source`/`author` + `knowledge_chunks.start_offset/end_offset`. Keys the "jump to exact passage" UX. |

Chunk schema is already correct and matches the brief's spec
(`document_id`/`conversation_id`/`message_id`/`chunk_id`/position/text/
start_offset/end_offset/source/timestamp` — current `knowledge_chunks`
covers item/chunk/offset/text/heading; add `source`+`timestamp` columns
when chunk-level provenance is needed for chat citations). All five layers
survive refresh / restart / new Claude sessions because they live in
Postgres, not in memory.

---

## PROPOSED SEARCH ARCHITECTURE

The exact-search path is ~80% there. Complete it per the brief:

### Three retrievers, one result shape

1. **Exact** — Postgres `tsvector` websearch (exists) + `pg_trgm` fallback
   (exists). Deterministic. Never replaced by an LLM. ✅ keep.
2. **Semantic** — **new** `pgvector` (or Supabase Vector happen to be
   available on self-hosted — verify) with NVIDIA embeddings generated
   server-side at ingest (one embedding per chunk; store in
   `knowledge_chunks.embedding vector`). Match-by-cosine, capped candidate
   set. NVIDIA embedding model name deferred until NVIDIA docs reviewed.
3. **Rerank** — NVIDIA reranker over the union of exact + semantic
   candidates, server-side only.

### Result = evidence, not documents

`ExactSearchResults` already returns passages with highlights, counts,
paginated, and `Open source →` deep-links. Extend:

- Add `Ask AI` action per result (feeds the chat with the chunk as context).
- Add filters (type, status, tag, date) — backend `readFilters` exists; UI
  `FilterBar` is missing.
- Keep `1/47 · Previous · Next` (present).
- **Replace** `KnowledgeChatWidget`'s duplicate items-mode search with the
  same exact-evidence renderer; one search codepath.

### Global ⌘K command menu

- Triggers: ⌘K / Ctrl-K, the header search affordance, and a mobile
  full-screen sheet.
- Modes: `navigate` (pages + entities), `search` (delegates to the
  retrievers above), `ask` (chat), `actions` (sync, run task, new decision).
  Typeahead; recent searches from `knowledge_search_history`.
- Unifies the currently-floating `KnowledgeChatWidget` FAB and the
  per-page `KnowledgeSearchPanel` into one component.

### Secrets

NVIDIA key stays server-side (`NVIDIA_API_KEY`, not prefixed `NEXT_PUBLIC_`).
The `/api/search` route calls NVIDIA server-side and returns only ranked
results + citation metadata to the client. No model names hard-coded — read
from env, validate against current NVIDIA docs at build-integration time.

---

## PROPOSED AI CHAT ARCHITECTURE

Evidence-first RAG, server-side:

```
QUESTION (client ⌘K "ask" or contextual "Ask AI about this prospect")
  → /api/chat (session, streaming via ReadableStream/SSE)
  → retrieve (exact + semantic) → NVIDIA rerank → select top-k evidence chunks
  → LLM (NVIDIA or Anthropic; ANTHROPIC_API_KEY exists in env)
  → answer + citations[]  (each citation = chunk_id + offsets + slug)
  → client renders citations as <SourceCitation>; click → /knowledge/[slug]?q=&chunk=
```

- "I couldn't find enough evidence in the knowledge base." when top evidence
  score < threshold (no hallucination).
- Persistent conversations: **new** `chat_sessions` + `chat_messages` tables
  (message_id, conversation_id, chunk refs). These are the
  `conversation_id`/`message_id` keys the brief's chunk spec wants.
- Streaming: SSE through the App Router route handler (no WS needed for
  one-directional tokens; keep WS only if bidirectional agent control is
  added later).
- Suggested follow-ups derived from retrieved entities; entity/document
  context injected; filters passed through.
- Replace today's `knowledge-chat-widget.tsx` floating box with an in-page
  contextual `AskPanel` on detail pages (prospect/campaign/research) AND the
  ⌘K "ask" path. No floating FAB.

---

## PROPOSED AGENT ARCHITECTURE

The execution surface exists (`task_runs` + runner + Realtime). Extend:

- **Typed agent runs**: generalize `task_type` beyond `script|cold_email|system`
  to `research|company-analysis|sop-author|outreach-research|file-process`.
  Each task_type maps to a runner (shell today; structured workflow later).
- **Progress reporting**: task runners write intermediate rows to a
  `task_run_events` table (or `task_runs.metadata` updates) so the dashboard
  shows `43 / 100 · Current: Company X`. Frontend subscribes via Realtime —
  same pattern as today, extended.
- **Creator boundary preserved**: agents may only write `proposed`/`ai_inferred`
  knowledge (CLAUDE.md rule) — enforce in the `publish` route, not by trusting
  the agent.
- **Command surface from terminal**: `npm run task` already exists; add
  `npm run agent research -- --targets companies.csv` style subcommands
  delegating to typed runners. All land in `task_runs` → visible on the
  Agents page and Command Center "Live agents" automatically.
- **No arbitrary shell from the browser** without acknowledging the security
  note (SECURITY.md): `api/tasks/execute` already runs arbitrary shell — keep
  behind session but surface its blast-radius in the UI rather than hiding it.

---

## PROPOSED REALTIME ARCHITECTURE

The repo already chose Realtime over polling for `task_runs`
(`20260821_task_runs_realtime.sql`). Extend the same pattern rather than
introducing a new mechanism:

- Convert the **dashboard aggregate** 10s poll (`dashboard-content.tsx`)
  to Realtime once a second high-frequency table exists; for now the 10s poll
  is acceptable and documented as a deliberate decision in DECISIONS.md — do
  not over-engineer.
- Agent progress: Realtime on `task_runs.metadata` updates (or a new
  `task_run_events` table) for the "43/100" UX.
- Chat streaming: SSE (simpler than WS for one-way tokens; no new infra).
- Knowledge sync events: optional Realtime on `knowledge_items` for live
  "what changed" rail — gated, since it can be chatty.
- One realtime boundary rule: subscribes always use the browser
  `authenticated` client and rely on RLS (as today for `task_runs`); any
  new realtime-revealed table needs the same `authenticated` SELECT policy.

No WebSockets, no message broker. Supabase Realtime + SSE is sufficient at
single-founder scale and matches existing infra.

---

## IMPLEMENTATION PLAN

Sequenced to ship value and respect the "don't rebuild everything at once"
rule. Each phase ends with a visually-inspected, console-checked milestone.

**Phase A — Design-system foundation (non-destructive)**
A1. Add `app/styles/tokens.css` + `tone.css`, map into `globals.css`. Define
     day/night tokens, named text tiers, reduced card radius.
A2. Wire `next-themes` into root layout (Day default, persisted).
A3. Add role type utilities (`.text-eyebrow` etc.) + motion wrapper with
     reduced-motion guard.
A4. Add `lib/` token lint (no raw hex/opacity-tier in tsx) — port
     marketing's contrast verifier.

**Phase B — Primitives**
B1. `<PageHeader>`, `<Section>`, `<Surface>`, `<StatusBadge>`,
     `<EmptyState>`, `<LoadingState>`, `<ErrorState>`.
B2. `<DataTable>` generalized from `ActivityTable`. `<Metric>` replaces
     `KpiCard`. `<FilterBar>`. `<Timeline>`. `<SourceCitation>`,
     `<EvidenceBlock>`.
B3. Re-wrap existing pages to consume primitives (no layout change yet).

**Phase C — Global shell + navigation**
C1. New sidebar IA (4 groups, segment-match active state).
C2. `<CommandMenu>` (⌘K) with navigate/search/ask/actions; SSE-ready.
C3. Remove floating `KnowledgeChatWidget` FAB; route "ask" through ⌘K +
     contextual in-page `AskPanel`.

**Phase D — Command Center redesign**
D1. Replace KPI wall with "What changed" rail + "Needs attention" +
     "Live agents" + one sparkline + activity table tail. Preserve all
     existing data sources.

**Phase E — Search completion**
E1. `FilterBar` UI wired to existing backend filters.
E2. Unify widget + panel into one evidence renderer.
E3. `Ask AI` per result.

**Phase F — Adaptive content system (skeleton)**
F1. `lib/content/registry.ts` + `content_type` enum + Zod schemas per type.
F2. Classifier hook (rule-based first; NVIDIA LLM later) at ingest.
F3. Renderers: `DocumentView`, `ProspectTable`, `EvidenceBlock` (PDF/CSV/image
     deferred behind typed subtasks).
F4. Wire `pdf-parse` into a PDF extractor.

**Phase G — AI chat (RAG)**
G1. `chat_sessions`/`chat_messages` migrations.
G2. `/api/chat` streaming RAG (exact+semantic检索 → rerank → LLM → citations).
G3. `<ConversationView>` + `<SourceCitation>` UI.
G4. Semantic: pgvector + NVIDIA embeddings at ingest. Reranker integration.

**Phase H — Agents + realtime progress**
H1. Typed `task_type` registry; `npm run agent ...` subcommands.
H2. `task_run_events` (or metadata updates) + Realtime for 43/100 UX.
H3. Agents page (history + live).

**Phase I — Memory layers**
I1. `working_memory` table + publish→long-term flow.
I2. Extend `entities`/`relations` population to classifier entities + typed
     relations.

**Phase J — Visual QA + a11y + perf**
J1. Playwright screenshots both themes; contrast audit; reduced-motion pass.
J2. Tables virtualized/paginated where > 200 rows; server-side search;
     lazy routes.
J3. ⌘K focus-trap, escape, restore focus; full keyboard pass.

NVIDIA integration belongs inside G2/G4 (and the chat rerank) — gated on a
fresh read of NVIDIA's current docs before any model id is committed.

---

## RISKS

1. **Marketing design system has Fraunces/Switzer; workspace-app has Geist.**
   Unifying type is a visible change and a real decision — leave as Geist (faster,
   free, mono pairing already works) or pull Fraunces in to match the brand?
   Recommend: keep Geist, add a label role and an optional display role later.
   *Awaiting your call.*
2. **Vercel-vs-VPS sync gap is data-correctness risk** for the adaptive
   system (disk-based sync no-ops on Vercel). If we add ingestion for CSV/PDF,
   those artifacts should live in Supabase Storage + the index in Postgres,
   so adaptive content does **not** depend on the filesystem. This is a
   deliberate architectural constraint, not a side-effect.
3. **Arbitrary shell exec surface** (`api/tasks/execute`) is load-bearing for
   "Claude Code as controlled operator" but means login = server root. The
   brief's security bar (server-side authorization) is technically met, but
   the UI must make this explicit, not invisible. Adding prompt-injection
   guardrails becomes urgent the moment we ingest untrusted third-party text
   (scraped web, inbound email) — the adaptive content system crosses that
   line. Guardrail subtask belongs in Phase F, not deferred.
4. **Self-hosted Supabase Vector availability** unverified — pgvector may or
   may not be enabled on the instance. Phase G semantic search depends on it;
   verify before committing the migration.
5. **Over-card regression**: every phase above tends to re-card. The
   `<Section>`/`<Surface>` split must be enforced by lint/PR review, or the
   console drifts back to "stack of rounded rectangles".
6. **No tests today.** Phases claiming "visually inspected" rely on manual
   Playwright screenshots; a `npm run typecheck` and a minimal test runner
   should be added in Phase A so later phases have a safety net.
7. **status CHECK constraint**: status is text-only today; the 6-state taxonomy
   in the migration comment and CLAUDE.md differ from the 4-state in
   `strategy/actions.ts`. Resolve before the adaptive content system
   introduces more states.
8. **NVIDIA model churn** — do not hard-code model ids; track them in env and
   revisit against NVIDIA docs at integration time (Phase G).

---

## DESIGN PRINCIPLES (the bar every PR is held to)

1. **The dashboard is a projection of backend truth**, not the source. Files
   are the source of truth; DB reflects files; UI reflects DB. No UI-only state
   that can't survive a refresh.
2. **Evidence over answers.** Every AI statement carries a citation that
   jumps to the exact passage. No evidence → say so.
3. **Adapt by schema, not by codegen.** Classifiers choose from a fixed
   renderer registry; the LLM never emits JSX.
4. **Discipline reads as expense.** One brand color, neutral surfaces, mono
   numerals, hairline rules, no gradients, no glass, no blobs, no floating
   widgets. Cards are selective, not universal.
5. **Density without clutter.** Tables and evidence lists are first-class;
   KPI walls are not. Reuse the `ActivityTable` discipline across surfaces.
6. **Motion serves orientation.** One easing curve, short durations, all
   collapsed under `prefers-reduced-motion`. Nothing bounces.
7. **No `dark:` variants.** Theme inherits from tokens; one component works
   on both axes.
8. **Security boundary is the backend.** Keys server-side; content treated as
   untrusted; shell exec surface acknowledged, not hidden.
9. **Build when there's something to build on.** Entity model, vector search,
   RBAC land when `knowledge/prospects/` has real content — not speculatively.
10. **Every change is visually inspected** in both themes at 390/768/1440
    with the console open before it is considered done. Code compiling is not
    "looks good".

---

## Status

Reconnaissance and audit complete. **No application code has been modified.**
Awaiting your approval and decisions on the open questions flagged above
(most importantly: **typeface decision**, **⌘K as the single global surface
vs. keeping a per-page panel**, and **Vercel-vs-Storage ingestion direction**
before Phase F). Once approved, execution begins at Phase A — design-system
foundation only — and pauses for review again after the primitives are in
place.
