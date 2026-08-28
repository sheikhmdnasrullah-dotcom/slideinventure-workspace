type BlockSnapshot = {
  flavour?: string
  props?: Record<string, unknown>
  children?: BlockSnapshot[]
}

function textFromDelta(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const delta = (value as { delta?: unknown }).delta
  if (!Array.isArray(delta)) return ""
  return delta
    .map((d) => (d && typeof (d as { insert?: unknown }).insert === "string" ? (d as { insert: string }).insert : ""))
    .join("")
}

function walk(block: BlockSnapshot | undefined, texts: string[], blockCounts: Record<string, number>) {
  if (!block) return
  for (const value of Object.values(block.props ?? {})) {
    const t = textFromDelta(value)
    if (t.trim()) texts.push(t.trim())
  }
  const flavour = block.flavour ?? ""
  if (flavour && flavour !== "affine:page" && flavour !== "affine:note" && flavour !== "affine:surface") {
    blockCounts[flavour] = (blockCounts[flavour] ?? 0) + 1
  }
  for (const child of block.children ?? []) walk(child, texts, blockCounts)
}

/**
 * Turns a BlockSuite (AFFiNE) doc snapshot — the `{ meta, blocks }` JSON the
 * block-canvas editor saves — into a plain-text description: the doc title
 * plus whatever text is actually written in its blocks, and a block-type
 * count for the rest. Real data only, same approach as the Excalidraw
 * summarizer — no vision model, no guessing at intent.
 */
export function summarizeAffineSnapshot(snapshot: Record<string, unknown> | null | undefined): string {
  if (!snapshot) return ""
  const meta = (snapshot as { meta?: { title?: unknown } }).meta
  const title = typeof meta?.title === "string" ? meta.title.trim() : ""
  const texts: string[] = title ? [title] : []
  const blockCounts: Record<string, number> = {}
  walk((snapshot as { blocks?: BlockSnapshot }).blocks, texts, blockCounts)
  if (!texts.length && !Object.keys(blockCounts).length) return ""

  const parts: string[] = []
  if (texts.length) parts.push(`Written on the board: ${texts.join("; ")}.`)
  const blocksDesc = Object.entries(blockCounts)
    .map(([flavour, n]) => `${n} ${flavour.replace(/^affine:/, "")}`)
    .join(", ")
  if (blocksDesc) parts.push(`Other blocks: ${blocksDesc}.`)
  return parts.join(" ")
}
