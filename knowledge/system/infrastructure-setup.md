---
id: system-2026-08-21-001
type: system
title: SlideIn Venture Infrastructure — Full Setup Summary
tags: [infra, vps, mailcow, caddy, supabase, pm2, github-actions, deploy, dns, cloudflare, ubuntu, contabo, gophish]
status: active
source: Infrastructure setup documentation, 2026-08-21
author: Nasrullah
created_at: 2026-08-21
---

## 1. Server

| Item | Value |
|---|---|
| Provider | Contabo VPS |
| IP | 169.58.207.75 |
| OS | Ubuntu 24.04 |
| RAM | 7.8 GB |
| SSH | root@169.58.207.75 |

This single VPS now runs: Mailcow (mail), Caddy (reverse proxy + SSL), Supabase (self-hosted backend), gophish, and two PM2-managed Next.js apps (website + workspace dashboard).

## 2. Mail Server (Mailcow)

| Item | Value |
|---|---|
| Install path | /opt/mailcow-dockerized |
| Mail domain | nasrullahtanim.me |
| Hostname | mail.nasrullahtanim.me |
| Webmail | https://mail.nasrullahtanim.me/SOGo/ |
| Admin panel | https://mail.nasrullahtanim.me/admin/ |
| Internal web ports | 8880 (moved off 8080 due to a gophish conflict, moved off 80/443 entirely since Caddy owns those) |
| First mailbox | hello@nasrullahtanim.me |
| Deliverability test | 10/10 on mail-tester.com |

**DNS records (Cloudflare, nasrullahtanim.me zone):**
- A: mail.nasrullahtanim.me → 169.58.207.75 (proxy OFF, grey cloud, required for mail)
- MX: nasrullahtanim.me → mail.nasrullahtanim.me, priority 10
- SPF: `v=spf1 mx -all`
- DMARC: `v=DMARC1; p=quarantine; rua=mailto:postmaster@nasrullahtanim.me; pct=100`
- DKIM: selector `dkim`, 2048-bit, host `dkim._domainkey.nasrullahtanim.me`

**Decision made:** keep Mailgun SMTP for cold outreach campaigns (better IP reputation for cold sending). Use this Mailcow server for receiving mail, internal comms, and transactional email. Google Workspace was fully retired for nasrullahtanim.me, MX records removed.

**Credentials:** Mailcow admin password and the hello@ mailbox password were both set directly in the UI during setup and were never typed into chat, add them to your password manager separately, they are not recorded anywhere in this summary.

## 3. Website + Dashboard Deployment

**Repo structure:** one GitHub monorepo (`slidein-venture`), two independent Next.js apps:
- Root folder → `slideinventure.com` (marketing website)
- `workspace-app/` subfolder → `workspace.slideinventure.com` (dashboard, connects directly to Supabase via `@supabase/supabase-js`)

**On the VPS:**
| Item | Value |
|---|---|
| Repo location | /opt/apps/slideinventure |
| Website process | PM2 name `website`, port 3000 |
| Workspace process | PM2 name `workspace`, port 3001 |
| Process manager | PM2, with `pm2 startup` configured so both survive VPS reboots |

**workspace-app/.env.local** (server-side, not in git) contains:
- `NEXT_PUBLIC_SUPABASE_URL=https://db.slideinventure.com`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (safe to expose client-side)
- `SUPABASE_SERVICE_ROLE_KEY=` (server-only, full DB access, never expose client-side or commit to git)

## 4. Reverse Proxy & Routing

**Important finding:** a pre-existing Caddy instance (system service, not Docker) was already running on ports 80/443, already correctly serving all domains with valid, auto-renewing Let's Encrypt certificates. The original plan to install a second reverse proxy (nginx) was abandoned once this was discovered, nginx is now disabled and unused, Caddy is the single front door for all web traffic.

**Caddy currently routes:**
- `slideinventure.com` → localhost:3000
- `www.slideinventure.com` → 301 redirect to `slideinventure.com`
- `workspace.slideinventure.com` → localhost:3001
- `db.slideinventure.com` → Supabase's internal Kong gateway (port 8000)
- `mail.nasrullahtanim.me` → Mailcow web UI (port 8880)

Caddyfile location: `/etc/caddy/Caddyfile`

**Port map reference file:** `/opt/PORT_MAP.md` on the VPS, kept up to date, single source of truth for what's running on which port.

## 5. DNS Cutover (slideinventure.com zone, Cloudflare)

- `slideinventure.com` and `workspace.slideinventure.com` A records were switched from Vercel to `169.58.207.75` (proxy ON, orange cloud, fine for regular web traffic)
- `www.slideinventure.com` A record also pointed to `169.58.207.75`, handled via Caddy redirect to the bare domain

## 6. Supabase (self-hosted, pre-existing)

| Item | Value |
|---|---|
| Location | /root/supabase/docker |
| Public URL | https://db.slideinventure.com |
| Internal API gateway | Kong, port 8000 |
| Postgres | ports 5432 / 6543 (internal, pooler) |

**Open item, flagged but not yet fixed:** Postgres pooler (5432/6543) and Envoy (8000) are still bound to `0.0.0.0` rather than localhost-only, meaning they're technically reachable from outside the VPS rather than strictly internal. Worth hardening this at some point, restricting to localhost or firewalling those ports, since Caddy is the only thing that should need to reach them.

## 7. Deploy Workflow

**Auto-deploy is live as of August 21, 2026.** Every push to `main` automatically deploys both apps to the VPS via GitHub Actions, no manual step required. Workflow file: `.github/workflows/deploy.yml` in the repo.

How it works: GitHub Actions SSHes into the VPS using a dedicated deploy key (`~/.ssh/github-actions-deploy` on the VPS, stored as the `VPS_SSH_KEY` secret in the GitHub repo, alongside `VPS_HOST` and `VPS_USER`), then runs the deploy scripts below.

Full setup and troubleshooting notes: see companion doc, `github-actions-auto-deploy-setup.md`.

**Underlying deploy scripts**, still live on the VPS at `/opt/scripts/`, aliased in `~/.bashrc`, and usable manually as a fallback anytime:
```bash
deploy-website      # pulls, installs, builds, restarts the website PM2 process
deploy-workspace     # same, for the workspace app
```
Both scripts use `set -e`, so if the build fails, the script stops before restarting PM2, meaning the live site keeps serving the last working build rather than going down. This mirrors how Vercel behaves, a failed build never takes down the live site. This safety behavior applies whether the script is triggered manually or via GitHub Actions.

**Failure notifications:** GitHub's built-in email alert for failed workflow runs is enabled (Settings → Notifications → Actions). A louder Slack/Discord webhook alert was considered but not yet added, revisit if email proves easy to miss.

**Local dev workflow stays the same:** edit locally, `npm run dev`. New habit given there's no review step before production: run `npm run build` locally before pushing anything uncertain, to catch errors before they're live rather than after.

## 8. Outstanding To-Dos

- [x] Set up GitHub Actions auto-deploy, done and confirmed live August 21, 2026
- [ ] Harden Supabase's exposed ports (5432/6543/8000) to localhost-only
- [ ] Set up Mailcow's automated backup script via cron, stored off-VPS
- [ ] Test real Gmail/Outlook inbox placement for the mail server (beyond mail-tester's score)
- [ ] Decide on the other two Mailgun-hosted domains, keep them on Mailgun for outreach as discussed, no migration planned
- [ ] Periodically recheck mxtoolbox.com/blacklists.aspx for this VPS IP
