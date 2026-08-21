// NVIDIA NIM client for embeddings + reranking. Every function here returns
// null instead of throwing on missing key / API failure — semantic search is
// an optional enhancement over lexical search, never a hard dependency.
// NVIDIA_API_KEY is read server-side only and never sent to the browser.

const BASE_URL = "https://integrate.api.nvidia.com/v1";
const EMBED_MODEL = "nvidia/llama-3.2-nv-embedqa-1b-v2";
const RERANK_MODEL = "nvidia/llama-nemotron-rerank-vl-1b-v2";
const EMBED_DIMENSIONS = 1024;

function apiKey(): string | null {
  return process.env.NVIDIA_API_KEY || null;
}

export async function embedTexts(
  texts: string[],
  inputType: "query" | "passage"
): Promise<number[][] | null> {
  const key = apiKey();
  if (!key || texts.length === 0) return null;

  try {
    const res = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: EMBED_MODEL,
        input_type: inputType,
        truncate: "END",
        dimensions: EMBED_DIMENSIONS,
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    const ordered = new Array<number[]>(texts.length);
    for (const item of data.data) ordered[item.index] = item.embedding;
    return ordered.every((e) => e) ? ordered : null;
  } catch {
    return null;
  }
}

export async function rerank(query: string, passages: string[]): Promise<number[] | null> {
  const key = apiKey();
  if (!key || passages.length === 0) return null;

  try {
    const res = await fetch(`${BASE_URL}/ranking`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: RERANK_MODEL,
        query: { text: query },
        passages: passages.map((text) => ({ text })),
        truncate: "END",
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { rankings: { index: number; logit: number }[] };
    const scores = new Array<number>(passages.length).fill(-Infinity);
    for (const r of data.rankings) scores[r.index] = r.logit;
    return scores;
  } catch {
    return null;
  }
}
