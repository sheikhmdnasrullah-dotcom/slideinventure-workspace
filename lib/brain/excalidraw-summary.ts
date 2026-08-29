type ExcalidrawElement = {
  type?: string;
  text?: string;
  isDeleted?: boolean;
};

/**
 * Turns an Excalidraw scene (the `{ elements, appState }` JSON boards store)
 * into a plain-text description: the labels/text actually drawn on the board,
 * plus a shape-count sketch of the rest. Real data only — no vision model, no
 * guessing at intent, just what's literally on the canvas.
 */
export function summarizeExcalidrawScene(contentJson: string): string {
  let data: unknown;
  try {
    data = JSON.parse(contentJson);
  } catch {
    return "";
  }
  const elements = Array.isArray((data as { elements?: unknown })?.elements)
    ? ((data as { elements: ExcalidrawElement[] }).elements)
    : [];
  if (!elements.length) return "";

  const texts: string[] = [];
  const shapeCounts: Record<string, number> = {};
  for (const el of elements) {
    if (!el || el.isDeleted) continue;
    if (el.type === "text" && typeof el.text === "string" && el.text.trim()) {
      texts.push(el.text.trim());
    } else if (el.type) {
      shapeCounts[el.type] = (shapeCounts[el.type] ?? 0) + 1;
    }
  }
  if (!texts.length && !Object.keys(shapeCounts).length) return "";

  const parts: string[] = [];
  if (texts.length) parts.push(`Labels and text on the board: ${texts.join("; ")}.`);
  const shapesDesc = Object.entries(shapeCounts)
    .map(([type, n]) => `${n} ${type}`)
    .join(", ");
  if (shapesDesc) parts.push(`Other shapes: ${shapesDesc}.`);
  return parts.join(" ");
}
