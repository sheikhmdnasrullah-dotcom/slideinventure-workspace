---
id: research-2026-08-18-001
type: research
title: ICP — founders who create content, need production + pipeline
tags: [icp, positioning, target-market]
status: ai_inferred
source: docs/site-architecture.md audit (2026-07-31); knowledge/sops/cold-email-outreach-system.md (sop-2026-08-18-001)
author: Tanim
created_at: 2026-08-18
---

## What this is

Synthesized from two existing real documents, not new independent research:
`docs/site-architecture.md` (states the audience directly) and the cold
email SOP (implies the same audience through its subject/opener rules).
Nobody has reviewed this as a formal ICP statement yet — treat as
`ai_inferred`, not confirmed.

## Stated audience

`docs/site-architecture.md` line 6: "**Audience:** Founders who create
content and need production + pipeline." This is the only explicit ICP
statement that currently exists in the codebase.

## What "need production + pipeline" cashes out to

Read against the two services SlideIn Venture actually sells
(`sop-2026-08-18-001`):

1. **Production gap** — they create content themselves but the editing,
   thumbnails, shorts/clips, and distribution work is a bottleneck they
   want off their plate.
2. **Pipeline gap** — they don't have consistent client acquisition /
   cold outreach running, so revenue is lumpy even when content output
   is steady.

The site's own solutions IA (`decision-2026-08-18-001`) mirrors this
exactly: `Content Production`, `Cold Outreach`, `Distribution` are the
three spokes off `/solutions` — there is no fourth service, which is
itself evidence the ICP is narrowly "creator-founder, not enterprise
marketing team."

## Signal this ICP is real (not just aspirational copy)

The cold email SOP's opener rule — "one specific, real detail from their
content" — only works as a system if the target genuinely publishes
content regularly and solo/small-team enough that a single founder-level
outreach effort can plausibly reach them. That constrains the ICP further:
solo or small-team creators, not creator networks or agencies with their
own ops staff.

## Open questions (not answered by existing docs)

- Platform focus — YouTube vs. newsletter vs. multi-platform?
- Revenue/audience-size floor worth prospecting at?
- Niche constraints, if any?

## Recommendation

Treat this file as a first-pass synthesis to react to, not a settled
definition. Founder should confirm or correct, then flip `status` to
`confirmed` by hand (per the SOP: nothing Claude writes defaults to
confirmed).
