---
id: decision-2026-08-18-001
type: decision
title: Marketing site navigation — 2-level hub-and-spoke, /contact as conversion endpoint
tags: [site-architecture, navigation, ia, marketing-site]
status: ai_inferred
source: docs/site-architecture.md (audit 2026-07-31)
author: Tanim
created_at: 2026-08-18
---

## Decision

Keep the SlideIn Venture marketing site flat: **2 levels max**, hub-and-spoke
from `/solutions`. Every page reachable within 2 clicks of the homepage. No
page gets a third level.

## Context

Audit on 2026-07-31 found the footer declaring 24 links, 22 resolving to
nothing (`/product/ai`, `/enterprise`, `/blog`, `/careers`, etc.) — leftover
Notion boilerplate, not an actual plan. `/portfolio` was linked from the
header nav and 404ing live. The footer wasn't even mounted in
`app/layout.tsx`, which is the only reason the broken links weren't a live
404 farm already.

## Structure

```
Homepage (/)
├── Solutions (/solutions)
│   ├── Content Production   (/solutions/content-production)
│   ├── Cold Outreach        (/solutions/cold-outreach)
│   └── Distribution         (/solutions/distribution)
├── Portfolio (/portfolio)
│   └── Case study           (/portfolio/{slug})
├── Pricing (/pricing)
├── About (/about)
└── Contact (/contact)
```

Header: 3 items + 1 CTA — `Solutions`, `Portfolio`, `Pricing`, `Let's Talk →`.
Footer: 3 columns (Services / Company / Legal), real routes only.

## Rule going forward

**A link ships only when its route ships.** No placeholder nav items.

## Priority order (from the 2026-07-31 backlog)

1. `/contact` — every funnel path terminates here, highest inbound link count
2. `/portfolio` — stops the live 404 from the header nav
3. Footer rewrite — 3 real columns, mounted in `app/layout.tsx`
4. Three `/solutions/{slug}` pages
5. `/about`, then `/privacy` + `/terms`

No redirects needed — none of the phantom URLs were ever live, so there's no
link equity or bookmark history to preserve.
