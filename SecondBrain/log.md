# Vault Operations Log

This file is a pointer, not a log. Entries live in `Logs/YYYY-MM-DD.md`, one file per day, append-only.

## Per-day file format

```yaml
---
type: log
date: YYYY-MM-DD
ai-first: true
---
```

Followed by entries, one per line, oldest first:

```
**HH:MM** - action | description
```

`action` is a short verb tag (e.g. `init`, `capture`, `sync`, `decide`). `description` is one line of plain English.

## Today

See `[[Logs/2026-08-19]]` for today's entries.
