/**
 * Board scopes.
 *
 * A board's scope is what section it belongs to, and the list endpoint filters
 * on it. Keeping the accepted set in one place fixes a real data-loss class of
 * bug: POST /api/boards used to accept only "ai-venture" and silently rewrite
 * everything else to "global", so a board created from Brainstorm or Research
 * was saved under a scope its own list query never asked for. The row existed
 * but the section showed an empty list, which reads to the user as "my board
 * disappeared".
 */

export const BOARD_SCOPES = [
  "global",
  "ai-venture",
  "brainstorm",
  "research",
  "ideas",
] as const;

export type BoardScope = (typeof BOARD_SCOPES)[number];

export function isBoardScope(value: unknown): value is BoardScope {
  return typeof value === "string" && (BOARD_SCOPES as readonly string[]).includes(value);
}

/** Unknown scopes fall back to "global" rather than throwing. */
export function normalizeBoardScope(value: unknown): BoardScope {
  return isBoardScope(value) ? value : "global";
}

/** Activity category and label per scope, so every board write reaches the feed. */
export const BOARD_SCOPE_ACTIVITY: Record<
  BoardScope,
  { category: "ai_venture" | "brainstorm" | "knowledge" | "notes"; label: string }
> = {
  global: { category: "notes", label: "Board" },
  "ai-venture": { category: "ai_venture", label: "Sketch" },
  brainstorm: { category: "brainstorm", label: "Brainstorm board" },
  research: { category: "knowledge", label: "Research board" },
  ideas: { category: "brainstorm", label: "Idea map" },
};
