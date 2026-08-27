@AGENTS.md

# PROJECT RULES

This dashboard started from the downloaded ShadcnStore dashboard template:
https://github.com/shadcnstore/shadcn-dashboard-landing-template

That template is our ORIGIN POINT, not a permanent constraint. As of 2026-08-27 we are
executing a deliberate first-party visual redesign (see "SlideIn Venture Design System"
below) — a proprietary "business operating system" identity, built on top of the existing
component logic and architecture. This supersedes the older "do not redesign / preserve
ShadcnStore layout exactly" rule that used to live in this file.

## SlideIn Venture Design System — active direction

- We ARE redesigning the visual language: sidebar, top bar, dashboard, modals, and
  per-section layouts (Leads, Research Lab, AI Venture, Agents, Knowledge, Documents,
  Terminal, Notepad, Brainstorm, Settings, Chat, command palette).
- Preserve existing business logic, data flow, auth, persistence, and routing. Redesign is
  presentation-layer + layout-structure, not a rewrite of functionality.
- Establish a real design token system (colors, type scale, spacing, radius, shadows,
  motion, z-index) instead of scattering magic numbers/classes.
- Keep the SlideIn Venture brand recognizable: warm neutral foundation, orange as a
  restrained accent for active/important/status states — not an all-orange UI.
- LIGHT MODE is the default and must always look correct. Dark mode / system mode are
  allowed as user-selectable options in Settings going forward (this reverses the old
  "light mode only" rule) — but do not make dark mode the default, and do not ship a
  section that only works in one theme.
- Vary visual structure by section intent (open workspace vs. data grid vs. execution
  console vs. library) instead of repeating the same card-grid pattern everywhere.
- No fake data, fake metrics, or fake activity to make screens look alive — use real
  application data and elegant empty states.
- Don't install a UI/animation library just because it exists — prefer the app's current
  infrastructure (Tailwind, shadcn/ui, existing primitives) unless something is clearly
  missing and free/open-source.
- After each meaningful redesign pass: run typecheck/build, then actually exercise the UI
  (browser tooling) before calling a section done.

Do not create unnecessary abstractions.

Do not refactor unrelated code.

Work directly in the existing repository.

After making changes:
run the relevant typecheck/build/test and fix actual errors.

Do not give long explanations.
Implement the task.
