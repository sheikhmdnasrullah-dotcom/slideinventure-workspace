# Project Workspace

An IDE-like project workspace inside the dashboard: each **Project** keeps its
working files (briefs, ICPs, strategy docs, SQL, research, uploads) in one
place, with an assistant that reads and revises those files alongside the user.
Every AI change is **proposed first** — the user reviews a before/after
comparison and accepts or rejects it. Nothing is overwritten silently.

## Access model: application-stored files

This implements **option A** from the build brief: files are stored by the
application on the server, under `PROJECT_WORKSPACE_DIR`
(default `<workspace-app>/data/projects/`, git-ignored). On the VPS this
should point outside the deployed checkout, e.g.
`PROJECT_WORKSPACE_DIR=/var/lib/slidein/projects`, so redeploys (rsync) never
touch user content.

Why not the alternatives:

- **Browser File System Access API (option B):** permission grants are fragile
  (re-prompt on revisit, no mobile support), files can't be used as AI context
  while the tab is closed, and nothing persists across devices. Upload covers
  "bring your own materials" with far less complexity.
- **Local companion app (option C):** unjustified while the workspace is
  single-tenant on the owner's VPS — the server *is* the owner's machine for
  practical purposes. Revisit only if multi-device local-folder sync becomes a
  requirement.

All file operations are owner-scoped (`<root>/<ownerId>/<projectId>/…`) and
the API re-checks `getSessionUser()` on every request. The
`ProjectStore` class is the single storage boundary: swapping the filesystem
backend for Appwrite Storage later means replacing one file.

## Layout

```
lib/project-workspace/
  types.ts       shared types + server-enforced LIMITS
  paths.ts       path validation (traversal-proof normalization)
  file-types.ts  kind detection + text extraction (pdf/docx/images/unknown)
  store.ts       ProjectStore — projects, tree, files, versions, search, proposals
  assistant.ts   AI tool layer (scoped tools + injection guardrails + context)
  diff.ts        dependency-free line diff (shared server/client)
  __tests__/     node:test suites (run: npm run test:project-workspace)

app/api/projects/…            REST API (auth + rate limits + validation)
app/(app)/projects/…          /projects list + /projects/[id] workspace pages
components/projects/…         tree, editor/tabs, assistant, proposals, history
```

## Supported file types

| Kind | Extensions | View | Edit | AI reads |
|---|---|---|---|---|
| Markdown/text | `.md` `.markdown` `.txt` `.text` `.log` | yes | yes | full text |
| SQL | `.sql` | yes | yes | full text |
| Structured text | `.json` `.yaml` `.yml` `.csv` `.tsv` | yes | yes | full text |
| Documents | `.pdf` `.docx` | extracted text | no (re-upload) | extracted text |
| Images | `.png` `.jpg` `.jpeg` `.gif` `.webp` `.svg` | preview | no | name only (honest) |
| Anything else | `*` | download only | no | name only (honest) |

Editable files are capped at 512 KB, uploads at 10 MB. Files the workspace
can't parse are kept and downloadable — the UI and the assistant say what they
can and can't do with them instead of pretending.

## How AI edits work

1. The user asks in plain language ("Update the brief from these notes").
2. The model reads files through scoped tools (`list_files`, `read_file`,
   `search_files`) — it gets no project id, no owner id, no shell.
3. It calls `propose_edit` / `propose_create` with the **full new content** and
   a one-sentence summary. It cannot apply changes itself.
4. The UI shows the proposal with a line diff; the user accepts or rejects.
5. Accepting snapshots the previous content (version history) and writes
   atomically. If the file changed since the proposal was made, accept fails
   with a conflict instead of overwriting.

Saves (user edits, restores, accepts) all require the file's current content
hash (`expectedHash`), so concurrent edits never silently overwrite each other.

## Security notes

- Every route requires a session; every store call re-validates the path and
  verifies the resolved absolute path stays inside the project dir.
- File contents are wrapped as `UNTRUSTED FILE CONTENT` before reaching the
  model, and the system prompt treats documents as data, never instructions.
  The tool surface has no apply/save/delete — proposals are the only write
  path, and only the logged-in user can accept them.
- No file contents, keys, or absolute server paths are written to logs; error
  responses carry codes, not internals.
- `.workspace/` (versions + proposals) is reserved and unreachable through the
  file API.

## Verifying

```bash
cd workspace-app
npm run test:project-workspace   # 30 unit tests (paths, diff, store, tools)
npm run lint                     # eslint
npx tsc --noEmit                 # typecheck
npm run build                    # production build
```

Then run the app (`npm run dev`, `DISABLE_AUTH=true` for local single-user
mode), open **Projects**, create a project, add files, and ask the assistant
about them. Without an LLM key configured the assistant reports honestly that
it can't answer while files/editing/history keep working.
