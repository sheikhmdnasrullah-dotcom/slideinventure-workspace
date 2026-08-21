export type Chunk = {
  chunkIndex: number;
  heading: string | null;
  text: string;
  startOffset: number;
  endOffset: number;
};

const HEADING_RE = /^#{1,6}\s+(.+)$/;

// Splits a markdown body into paragraph-sized chunks on blank lines, tracking
// the nearest preceding heading and the chunk's offsets into the original
// body string (used later for highlighting and scroll-to-source).
export function chunkBody(body: string): Chunk[] {
  const chunks: Chunk[] = [];
  let currentHeading: string | null = null;
  let cursor = 0;
  let chunkIndex = 0;

  const parts = body.split(/\n\s*\n/);

  for (const part of parts) {
    const start = body.indexOf(part, cursor);
    const end = start + part.length;
    cursor = end;

    const lines = part.split("\n");
    for (const line of lines) {
      const match = line.trim().match(HEADING_RE);
      if (match) currentHeading = match[1].trim();
    }

    const text = part.trim();
    if (!text) continue;

    chunks.push({
      chunkIndex: chunkIndex++,
      heading: currentHeading,
      text,
      startOffset: start,
      endOffset: end,
    });
  }

  return chunks;
}
