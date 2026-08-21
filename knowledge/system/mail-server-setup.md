---
id: system-2026-08-20-001
type: system
title: Mail Server Setup Reference — mail.nasrullahtanim.me
tags: [mail, mailcow, docker, dns, spf, dkim, dmarc, mailgun, vps, ubuntu, contabo]
status: active
source: Mail server setup documentation, 2026-08-20
author: Nasrullah
created_at: 2026-08-20
---

## Server Details

| Item | Value |
|---|---|
| Provider | Contabo VPS |
| Server IP | 169.58.207.75 |
| Hostname | mail.nasrullahtanim.me |
| SSH access | root@169.58.207.75 |
| OS | Ubuntu 24.04 |
| Timezone | Asia/Dhaka |
| Total RAM | 7.8 GB |
| Disk | 103 GB (22 GB used as of setup) |

This VPS also runs a separate self-hosted Supabase stack (auth, storage, postgres, studio, etc). Supabase uses ports 8000, 5432, 6543. Mailcow does not conflict with these, its internal MySQL binds only to 127.0.0.1:13306.

## Mail Stack

| Item | Value |
|---|---|
| Software | Mailcow (Dockerized) |
| Install path | /opt/mailcow-dockerized |
| Version | 2026-07b (master branch) |
| Web admin | https://mail.nasrullahtanim.me/admin/ |
| Webmail (SOGo) | https://mail.nasrullahtanim.me/SOGo/ |
| HTTP/HTTPS ports | 80 / 443 |
| SSL | Let's Encrypt, auto-issued and auto-renewing via the acme container |

**Note**: the system's default nginx (unrelated to Mailcow) had to be stopped and disabled to free up port 80/443:
```
systemctl stop nginx
systemctl disable nginx
```

## Domain and Mailboxes

| Item | Value |
|---|---|
| Mail domain | nasrullahtanim.me |
| First mailbox created | hello@nasrullahtanim.me |
| Mailbox password | Set during setup, not recorded here, add it yourself before saving to your KB |
| Admin panel login | Username: admin. Password was changed from the Mailcow default (moohoo) during setup, not recorded here, add it yourself |

## DNS Records (set in Cloudflare)

| Type | Host | Value |
|---|---|---|
| A | mail.nasrullahtanim.me | 169.58.207.75 (proxy OFF, grey cloud, DNS only) |
| MX | nasrullahtanim.me | mail.nasrullahtanim.me, priority 10 |
| SPF (TXT) | nasrullahtanim.me | v=spf1 mx -all |
| DMARC (TXT) | _dmarc.nasrullahtanim.me | v=DMARC1; p=quarantine; rua=mailto:postmaster@nasrullahtanim.me; pct=100 |
| DKIM (TXT) | dkim._domainkey.nasrullahtanim.me | v=DKIM1;k=rsa;t=s;s=email;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwjHannhp38nWUsXMXsvDqm5cF3HoFzBEpxqwwawSxTzEvX68R1g9SOx5SnyYQhOSPlkt+sRI/qJ7WoRsxbJAxfD88xS5l2q/3c+iWeWKL6g9UbeiXyffb97X73cHKMYUsT3lvA8ERO9aPPk9twCUkjeTcTdpgq+KsYGNlQjeuzDkt6SV9lSkASiMsR+I4sZgR8JOhDj1kJruhXZbcyvGhLAQd7NrHQgYhkt6HuLBclsUWtU9RUt8hDXbo8EiFXIv9R7fqu72baR276rsYKqNOU8H33rBmsjob/M1asvtn/U0hAx4BCxxqgaNQpay4Z5lXDazkaCPIOItvknCvm67RwIDAQAB |
| TXT (kept, unrelated) | nasrullahtanim.me | google-site-verification=jgwHw3iU7r7CecH_Ny8H2NRL9_7JnqbP_JNTThU6Y20 (Search Console ownership, harmless to keep) |

DKIM selector: `dkim`, key length: 2048-bit.

## What Was Removed

- Google Workspace MX records for nasrullahtanim.me (fully removed, this domain no longer routes mail through Google)
- Old duplicate SPF record: `v=spf1 include:_spf.google.com ~all`
- Old duplicate DMARC record pointing to hello@nasrullahtanim.me with adkim/aspf flags

## Deliverability Test Result

- Tested via mail-tester.com on August 20, 2026
- Score: 10/10
- SPF, DKIM, and DMARC all authenticated correctly, SpamAssassin passed clean

## Strategic Decision: Mailgun vs Self-Hosted

Discussed and decided:
- **Keep Mailgun SMTP for cold outreach campaigns.** Mailgun's IP reputation and warmup history beat a brand-new self-hosted IP for cold sending, this matters most for SlideIn Venture's outreach work.
- **Use this Mailcow server for receiving mail, internal communication, and transactional email** (invoices, notifications), where reputation risk is lower.
- **Do not migrate the other two domains to Mailcow for outreach purposes.** A hybrid setup, Mailcow for hosting/receiving, Mailgun for outbound cold email, was recommended instead of a full migration.

## Outstanding To-Dos

- [ ] Set up automated backups via `/opt/mailcow-dockerized/helper-scripts/backup_and_restore.sh`, scheduled via cron, stored off this VPS
- [ ] Send real test emails to a Gmail and an Outlook address to confirm inbox placement (not just mail-tester score)
- [ ] Add any additional mailboxes needed beyond hello@nasrullahtanim.me
- [ ] Decide final routing setup for the other two domains currently on Mailgun
- [ ] Periodically recheck mxtoolbox.com/blacklists.aspx for this VPS IP
- [ ] Monitor disk usage on the VPS as mail volume grows (`df -h`)

## Useful Commands

```bash
# Check all Mailcow containers
cd /opt/mailcow-dockerized && docker compose ps

# View nginx logs
docker compose logs nginx-mailcow --tail=50

# View acme (SSL) logs
docker compose logs acme-mailcow --tail=30

# Full restart if something breaks
docker compose down && docker compose up -d

# Update Mailcow
cd /opt/mailcow-dockerized && git pull && docker compose pull && docker compose up -d
```
