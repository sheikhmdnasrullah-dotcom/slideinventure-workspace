# Claude Operating Manual - Sheikh Md Nasrullah (Tanim)'s Vault

> Read this file before doing anything in this vault.
> This is the single source of truth for how Claude operates here.

---

## Section 0 - AI-First Vault Rule (read first, applies to every note)

This vault is designed for **future agent** to read and reason over, not for human review. The owner rarely reads notes directly - they call Claude to retrieve, synthesize, and connect dots across years of accumulated knowledge.

**Every note Claude writes to this vault must follow these rules:**

1. **Self-contained context** - Each note must explain itself. Future-Claude may pull this single note via search with no surrounding context. Don't rely on backlinks alone for meaning.
2. **"For future agent" preamble** - Every note begins with a 2-3 sentence summary in plain English so Claude can decide relevance in 10 seconds before parsing the structured data.
3. **Rich, consistent frontmatter** - Filterable metadata (`type`, `date`, `topic`, `tags`, `related-people`, `related-projects`, `sources`, `confidence`). Different note types may have different schemas, but every note has machine-readable frontmatter.
4. **Recency markers per claim** - When stating external facts, attach the date: "Mem0 raised $24M (as of 2026-04)" so future agent knows what to verify before trusting.
5. **Sources preserved verbatim** - Every external claim has its source URL inline so it can be re-verified or refreshed.
6. **Cross-links are mandatory** - Every person, project, idea, decision, or concept referenced uses `[[wikilinks]]` so the graph is traversable.
7. **Confidence levels** - Where applicable, mark claims as `stated | high | medium | speculation` so future agent knows what to trust vs verify.

This rule applies to all `/obsidian-*` and `/research*` commands, all scheduled agents, and any direct vault writes. Full spec: `references/ai-first-rules.md` in the obsidian-second-brain skill.

---

## Section 0.5 - Verify Live State Before Acting

Before declaring a bug, drafting a fix, or writing architecture: read the actual code, schema, deployed branch, env, or live data. Speculation from stale context burns hours and produces drafts that contradict reality.

Specific cues:
- Read the schema or types before declaring a bug (real field names live in the code, not in memory)
- `git fetch origin` and read the deployed branch, not local `main`
- Grep the live file before any anchor-based patch
- Fetch live time, dates, and rates (never infer from training data)
- Verify env vars in the running process before blaming code
- Mock tests miss schema drift: read one real payload before declaring "done"

This is a general operating principle, not vault-specific.

---

## Vault Identity

- **Owner:** Sheikh Md Nasrullah (goes by Tanim)
- **Primary purpose:** TBD - vault was empty at init (2026-08-19), only default `Welcome.md` present. Ask the owner what this vault is for (work OS, personal life OS, side business, etc.) and update this section once known.
- **Last updated:** 2026-08-19

---

## Folder Map

Vault style: **Obsidian-style** (chosen at init because no `wiki/` folder existed yet). None of these folders contain notes yet - they are created on first use, not pre-populated.

| Folder | Purpose |
|---|---|
| `Daily/` | One note per day. Named `YYYY-MM-DD.md` |
| `Projects/` | Active and archived projects |
| `Tasks/` | Standalone task notes (linked from boards) |
| `Boards/` | Kanban boards |
| `People/` | One note per person |
| `Dev Logs/` | Technical work logs - dated, project-tagged |
| `Knowledge/` | Reference material and permanent notes |
| `Learning/` | Books, courses, content consumed |
| `Ideas/` | Idea captures |
| `Content/` | Content calendar and post drafts |
| `Goals/` | Annual and life goals |
| `Reviews/` | Weekly / monthly reviews |
| `Templates/` | Note templates (Templater) |
| `Logs/` | Vault operation log, one file per day (`YYYY-MM-DD.md`) |
| `Bases/` | Obsidian Bases views (Projects, People, Tasks, Daily) |

Folders not listed above (e.g. `Finances/`, `Mentions/`, `Jobs/`, `Businesses/`) are not yet in use - add rows here if the owner starts using them.

---

## Key Files

- **Index:** `[[index]]` - catalog of every note in the vault, read this first
- **Vault log:** `[[log]]` - pointer to `Logs/` per-day operation log
- No dashboard (`Home.md`), boards, or people/project notes exist yet - this is a fresh vault as of 2026-08-19.

---

## Active Context

> Update this section at the start of each major project or focus period.

**Current top priority:** TBD - not yet stated by owner
**Current job:** TBD
**Manager:** TBD
**Key colleagues:** TBD

---

## Auto-Save Rules

Claude should auto-save the following **without asking**:
- Decisions made in conversation -> relevant project note + daily note
- New people mentioned -> `People/` (create stub if needed)
- Tasks assigned or committed to -> kanban board + `Tasks/` note
- Dev work done -> `Dev Logs/` + project note + daily note
- Completed tasks -> move on kanban to Done

Claude should **ask before saving**:
- Anything touching `Finances/` or personal financial data
- `Private/` or `Journal/` (private notes)
- Anything that involves deleting or archiving an existing note

---

## Naming Conventions

- Daily notes: `YYYY-MM-DD.md`
- Dev logs: `YYYY-MM-DD - Description.md`
- Tasks: Descriptive title, no date prefix
- People: Full name (e.g. `Jane Smith.md`, not `Jane.md`)
- Archive prefix: `_archived_`

---

## Frontmatter Requirements

Every note must have at minimum:
```yaml
---
date: YYYY-MM-DD
type: <note-type>
tags:
  - <note-type>
ai-first: true
---
```

Full type-specific schemas: `references/ai-first-rules.md` (Type Schemas section) in the obsidian-second-brain skill.

---

## Kanban Convention

Columns in boards: `📥 Backlog` · `📋 This Week` · `🔨 In Progress` · `⏳ Waiting On` · `✅ Done`

Priority: 🔴 critical · 🟡 important · 🟢 low

Item format:
```
- [ ] 🔴 **Title** · @{YYYY-MM-DD}
	Description. [[Related Project]] [[Person]]
```

Completed:
```
- [x] ~~🔴 **Title**~~ ✅ Date
```

No boards exist yet - create one under `Boards/` the first time the owner asks for task tracking.

---

## Propagation Rules

| Event | Also update |
|---|---|
| New project | Board (Backlog) + today's daily note |
| Task done | Board (Done, strikethrough) + project note + daily note |
| Dev session | Dev Logs/ + project note (Recent Activity) + daily note |
| Person interaction | Daily note + their People/ note |
| Decision made | Project note (Key Decisions) + daily note |

---

## People to Know

> Empty - no people captured yet.

| Person | Role | Notes |
|---|---|---|
| - | - | - |

---

## Projects Currently Active

> Empty - no projects captured yet.

---

## Do Not Touch

- `Templates/` - Never modify templates during normal vault operations
- `Private/` - Private. Read only if directly asked.

---

*This file was generated by the obsidian-second-brain skill on 2026-08-19.*
*Regenerate with: "Claude, update my `_CLAUDE.md`"*
