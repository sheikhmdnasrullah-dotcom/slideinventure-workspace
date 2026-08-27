// Notes store their body as a JSON-serialized BlockNote document (see
// components/dashboard/notepad-view). This walks the block tree
// generically (by "text" / "content" / "children" shape) rather than
// depending on BlockNote's exact block-type union, so it stays correct as
// new block types are added.
export function blockNoteToPlainText(raw: string | null | undefined): string {
  if (!raw) return "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw; // not JSON, treat as already-plain text
  }

  const out: string[] = [];
  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      if (typeof obj.text === "string") out.push(obj.text);
      if (obj.content) walk(obj.content);
      if (obj.children) walk(obj.children);
    }
  }
  walk(parsed);
  return out.join(" ").trim();
}
