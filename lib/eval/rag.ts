import "server-only";
import { chatCompletion } from "@/lib/llm/gateway";
import { searchVector } from "@/lib/retrieval/vector-index";

export type RagMetric = { score: number; reason: string };

export type RagEvalResult = {
  ok: boolean;
  faithfulness: RagMetric;
  answerRelevancy: RagMetric;
  contextRelevancy: RagMetric;
  answer: string;
  contexts: string[];
  error?: string;
};

function parseScore(raw: string): RagMetric {
  try {
    const json = JSON.parse(raw.replace(/^```json|^```|```$/g, "").trim());
    return {
      score: Math.max(0, Math.min(1, Number(json.score) || 0)),
      reason: String(json.reason || "").slice(0, 400),
    };
  } catch {
    const m = raw.match(/([01](?:\.\d+)?)/);
    return { score: m ? Number(m[1]) : 0, reason: raw.slice(0, 200) };
  }
}

const JUDGE = (system: string, user: string) =>
  chatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.1, json: true }
  );

/**
 * Ragas-style RAG evaluation (LLM-as-judge). The official Ragas JS SDK is not
 * published for Node, so this reproduces the three canonical metrics using our
 * NVIDIA gateway: faithfulness, answer relevancy, context relevancy. Internal
 * eval only: not user-facing scoring of production answers.
 */
export async function evaluateRag(opts: {
  query: string;
  contexts?: string[];
  answer?: string;
}): Promise<RagEvalResult> {
  try {
    let contexts = opts.contexts;
    if (!contexts || contexts.length === 0) {
      const hits = await searchVector(opts.query, { limit: 5 }).catch(() => []);
      contexts = hits.map((h) => h.text);
    }
    const contextBlock = (contexts || []).map((c, i) => `[[${i + 1}]] ${c}`).join("\n\n");

    let answer = opts.answer;
    if (!answer) {
      answer = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You are a helpful assistant. Answer the question using ONLY the provided context. If the context is insufficient, say so.",
          },
          { role: "user", content: `Context:\n${contextBlock}\n\nQuestion: ${opts.query}` },
        ],
        { temperature: 0.3 }
      );
    }

    const faith = await JUDGE(
      "You are an evaluation judge. Decide whether the ANSWER is fully supported by the CONTEXT (no contradictions, no hallucinated facts). Respond ONLY JSON: {\"score\": <0-1>, \"reason\": \"...\"}",
      `CONTEXT:\n${contextBlock}\n\nANSWER:\n${answer}`
    );
    const ansRel = await JUDGE(
      "You are an evaluation judge. Decide whether the ANSWER addresses the QUESTION. Respond ONLY JSON: {\"score\": <0-1>, \"reason\": \"...\"}",
      `QUESTION:\n${opts.query}\n\nANSWER:\n${answer}`
    );
    const ctxRel = await JUDGE(
      "You are an evaluation judge. Decide whether the CONTEXT is relevant to the QUESTION. Respond ONLY JSON: {\"score\": <0-1>, \"reason\": \"...\"}",
      `QUESTION:\n${opts.query}\n\nCONTEXT:\n${contextBlock}`
    );

    return {
      ok: true,
      faithfulness: parseScore(faith),
      answerRelevancy: parseScore(ansRel),
      contextRelevancy: parseScore(ctxRel),
      answer,
      contexts: contexts || [],
    };
  } catch (err) {
    return {
      ok: false,
      faithfulness: { score: 0, reason: "" },
      answerRelevancy: { score: 0, reason: "" },
      contextRelevancy: { score: 0, reason: "" },
      answer: opts.answer || "",
      contexts: opts.contexts || [],
      error: err instanceof Error ? err.message : "eval failed",
    };
  }
}
