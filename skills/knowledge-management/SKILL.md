# Skill: Knowledge Management

## Purpose
Create and update structured knowledge files in /knowledge with correct
frontmatter, provenance, and status.

## When to use
Any time the founder asks you to research something, record a decision,
document an SOP, or update existing knowledge.

## Process
1. Search /knowledge for existing related files. If one exists, update it
   rather than creating a duplicate, note what changed and why.
2. Determine the correct type folder (research, prospects, sops, decisions).
3. Write the file with full frontmatter. Set status to proposed or
   ai_inferred, never confirmed.
4. Always fill in source, a URL, "founder conversation", etc.
5. Run npm run sync after writing — always, without being asked separately.
6. Tell the founder what you created/updated and flag anything uncertain.

## Research requests specifically

When the founder asks you to research something (not just record a
decision or SOP), the process above still applies, plus:

- Search at least two independent sources, not just one article.
- Cross-check the actual claims/numbers across those sources before
  writing anything down. Where sources disagree, say so in the file
  instead of picking one silently.
- `source` in frontmatter must be the real URLs you pulled from
  (semicolon-separated if multiple), never a placeholder like "web
  search" or "internet".
- If you can't find at least two sources for a claim, say that
  explicitly in the file (see "Open questions" pattern) rather than
  writing it as if it were well-established.
- Sync step (5 above) is not optional or something to ask about — run it
  right after writing the file, same turn.
