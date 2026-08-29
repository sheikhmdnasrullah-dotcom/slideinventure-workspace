# Deanonymization + AI Video Outreach — Cost, Performance, and Solo-Operator Viability (2026)

## Executive Answer

Both phases are technically buildable by a solo operator, but at different costs and different operational risk. Deanonymization tooling (Warmly/Bullseye) is cheap to run per client at low volume — realistically **$100–850/month per client** depending on vendor and tier — and, once configured, is largely passive/automated. AI video personalization is also cheap per seat ($39–299/month) but is **not** passive: every lead needs a script variant, thumbnail, and QA pass, which does not scale linearly with a single person's time. Performance claims for AI video (2–4x reply-rate lift, up to 30% in "deep personalization" case studies) all trace back to vendor blogs — no independent, third-party benchmark was found. No vendor currently sells deanonymization + AI video personalization as one packaged product, which is a real gap — but it also means Tanim would be assembling and operating a multi-vendor stack manually, which is the actual bottleneck, not the tooling cost.

---

## 1. Warmly & Bullseye — realistic solo/single-client cost (2026)

**Warmly**: Free tier caps at 500 de-anonymized visitors/month, company-level names only, no automation, limited Bombora intent signals. A "Starter" tier is reported around **$73/month** for up to 50 identified companies with CRM integration. Beyond that, Warmly's real product (person-level ID, automation, lead routing) is sold as annual-only packages: **AI Web-Deanonymization $10,000/yr (~$833/mo)**, Inbound Chat $20,000/yr (~$1,667/mo), AI Inbound Autopilot $30,000/yr (~$2,500/mo) — all requiring a 10,000-credit/month minimum and a 12-month contract. Quarterly billing costs ~25% more. This makes Warmly's *real* tier expensive for a single client unless resold across several clients to amortize the annual commitment.

**Bullseye**: Self-serve, no annual lock-in. **$99/month for 200 identification credits**, with Contact Database and B2B phone lookups included, 14-day free trial, ~40% person-level ID rate (confirms prior research). This is the realistic entry point for running deanonymization on one client's site at solo-operator scale.

**Practical number**: for one client, Bullseye at ~$99–199/month is viable; Warmly only makes sense once either reselling to several clients or a client's traffic volume justifies the ~$833/mo minimum tier.

Sources: [Warmly Pricing Breakdown 2026 – MarketBetter](https://marketbetter.ai/blog/warmly-pricing-2026/), [warmly.ai/pricing](https://www.warmly.ai/pricing), [Bullseye Pricing](https://www.bullseye.so/pricing), [Bullseye on Capterra](https://www.capterra.com/p/10037169/Bullseye/)

## 2. AI video personalization vendors — 2026 landscape

Confirmed real and currently operating in 2026:

| Vendor | Entry price | Volume at entry | Notes |
|---|---|---|---|
| **Sendspark** | $49/mo (Solo) | 100 dynamic video minutes | Cheapest true dynamic-personalization tool; name spoken in your voice, prospect's website as live background |
| **BHuman** | $39/mo (Growth) | 200 videos ($0.65/extra) | Cheapest per-video cost at scale ($0.39–0.65); has separate "Speakeasy" text-to-video product from $9/mo |
| **Potion** | $99/mo/seat | 750 videos/mo | Built for B2B sales teams; pricier, more polished dynamic-background personalization |
| **HeyGen** | $24/mo | Avatar-based, auto video+link per row | General-purpose avatar video tool repurposed for outreach; SOC2 Type II, SSO — best for scale/security, less purpose-built for cold outreach than Sendspark/BHuman |
| **Vidyard** | $59/user/mo (annual) | Unlimited recording | Enterprise-sales-org oriented, priced per seat, not built for solo multi-client reselling |

For a solo operator running this across multiple clients, **BHuman and Sendspark are the most realistic entry stack** — lowest fixed cost, volume-based scaling, and per-video overage pricing that maps cleanly to a per-client line item. Potion and Vidyard are pitched at in-house sales teams, not agencies reselling per-client capacity.

Sources: [Sendspark Review – SalesRobot](https://www.salesrobot.co/blogs/sendspark-review), [BHuman on Salesforge](https://www.salesforge.ai/directory/sales-tools/bhuman), [Potion Pricing](https://sendpotion.com/pricing/), [HeyGen Sales Outreach](https://www.heygen.com/use-cases/sales-outreach), [Vidyard Pricing – Vendr](https://www.vendr.com/marketplace/vidyard)

## 3. Verified performance data — video vs. text cold email

No independent, third-party controlled study isolating video-personalization lift was found. Every "2–4x reply rate" and "30% reply rate" figure traces back to vendor blogs (Sendspark, HeyGen, Vidyard) or single self-selected vendor case studies (Sendspark's Brikl case study: 62% open increase, 4x reply boost; an Intercom case citing +19% reply rate from adding async video). Independent, vendor-neutral baseline data does exist for cold email generally: average cold email reply rate is **~3.43%** per aggregate industry benchmarks, and Backlinko's large-sample study puts average response rate near **8.5%** across millions of emails — neither is video-specific.

**Conclusion**: directional evidence supports video personalization outperforming plain text, but the magnitude (2x–4x, up to 30%) should be treated as vendor marketing, not verified science, since no neutral third party has replicated these numbers.

Sources: [Cold Email vs Video Email – Sendspark](https://blog.sendspark.com/cold-email-vs-video-email-replies), [HeyGen – Increase Cold Email Open Rates](https://www.heygen.com/blog/increase-cold-email-open-rates-with-personalized-ai-videos), [B2B Cold Email Statistics 2026 – Martal](https://martal.ca/b2b-cold-email-statistics-lb/), [Cold Email Guide 2026 – Autobound](https://www.autobound.ai/blog/cold-email-guide-2026)

## 4. Solo-operator workload — is the full stack sustainable?

General solo-agency capacity research (not AI-specific) puts a sustainable ceiling around **3–8 active clients** depending on service intensity, with effective billable capacity closer to 60–75% of nominal hours once context-switching and admin are accounted for. Applied to this stack: deanonymization + trigger monitoring is largely passive once configured (alerts, auto-notes, CRM sync run themselves) and scales across clients reasonably well. AI video personalization does **not** scale the same way — each lead needs a script variant, thumbnail choice, and a sanity-check pass before it goes out, which is manual, creative labor that grows roughly linearly with lead volume and client count.

Sources: [How Many Accounts – Databox](https://databox.com/how-many-accounts), [One-Person Agency – Peaklora](https://peaklora.com/blog/agencies-that-are-just-one-person/)

## 5. Real competitors combining both offers

No vendor found packages deanonymization identification and AI video personalization as one product. The identification layer (Warmly, Bullseye, Common Room, RevSure, LeadMagic) and the video-personalization layer (Sendspark, BHuman, Potion, HeyGen, Vidyard) remain separate categories in 2026. Common Room's RoomieAI generates AI outbound snippets from signals but stays text-based. This is a genuine service-layer gap — nobody sells "signal-triggered personalized video" as a single SKU — but it means Tanim's advantage is integration/operating know-how, not proprietary tech, and a well-funded competitor or the vendors themselves could close this gap by adding native integrations.

Sources: [Common Room – Deanonymize Website Activity](https://www.commonroom.io/blog/website-visitor-identification/), [Best Website Visitor Identification Software 2026 – Factors.ai](https://www.factors.ai/blog/visitor-identification-software)

---

## Recommendation

**Core MVP (build first, keep):**
- Bullseye for deanonymization (~$99–199/mo/client) — cheap, self-serve, no annual lock-in, fits one-client-at-a-time billing.
- Trigger-event monitoring + auto-generated "why now" notes — automatable, low ongoing labor, high perceived value.
- AI video personalization limited to a **small top-tier segment only** (top 10–20 hottest leads/week or named ABM accounts) using BHuman or Sendspark — not blanket video for every identified visitor.

**Cap client count for the full-stack (dean + video) offer at 1–3 clients solo.** Beyond that, either hire/contract a video-ops assistant or downgrade additional clients to a "deanonymization + alerts only" lite tier without personalized video.

**Later, once team/tooling exists:**
- Warmly's full automation tier (only once reselling across enough clients to justify the ~$833–2,500/mo annual commitment).
- Video personalization at full blanket scale across all identified leads.
- ABM named-account video landing pages — high production value, best deferred until there's dedicated capacity or a template library reduces per-lead effort.
