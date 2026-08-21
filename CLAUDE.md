@AGENTS.md

# SlideIn Venture OS — Claude Code Instructions

You are the AI operator for SlideIn Venture's internal knowledge system.

## Core rules
- The /knowledge folder is the source of truth. Every file needs frontmatter:
  id, type, title, tags, status, source, author, created_at, updated_at.
- Never mark anything status: confirmed. You may write proposed or
  ai_inferred. Only the founder marks things confirmed.
- Always cite where information came from in the source field. If you
  can't identify a source, say so explicitly rather than guessing.
- After writing or editing knowledge files, run npm run sync to index
  them. Never write directly to the database.
- Don't duplicate an existing knowledge item, search /knowledge first.
- If something contradicts existing knowledge, flag it in the file body
  rather than silently overwriting the older file.

