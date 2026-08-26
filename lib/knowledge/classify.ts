import "server-only";
import { nvidiaComplete } from "@/lib/llm/nvidia";

export type KnowledgeCategory = "note" | "sop" | "system" | "research";
const VALID: KnowledgeCategory[] = ["note", "sop", "system", "research"];

// Cheap keyword heuristic — used when the LLM call fails, times out, or
// there isn't enough text to bother with a model call at all. Never blocks:
// worst case it falls through to "note", the general bucket.
function heuristicClassify(text: string): KnowledgeCategory {
  const t = text.toLowerCase();
  const sopSignals = ["step 1", "steps to", "how to onboard", "procedure", "checklist", "sop", "workflow:", "instructions:"];
  const systemSignals = ["server", "infrastructure", "configuration", "config", "deployment", "database", "api key", "environment variable", "architecture"];
  const researchSignals = ["research", "study", "findings", "analysis", "survey", "benchmark", "hypothesis"];

  if (sopSignals.some((s) => t.includes(s))) return "sop";
  if (systemSignals.some((s) => t.includes(s))) return "system";
  if (researchSignals.some((s) => t.includes(s))) return "research";
  return "note";
}

/**
 * Best-effort classification of freeform input into a Knowledge category.
 * Never throws and never blocks the caller — on any failure, timeout, or an
 * unrecognized answer, it falls back to the heuristic (which itself always
 * resolves, defaulting to "note"). Accept first, organize intelligently
 * after: the caller should never surface this as a required decision.
 */
export async function classifyKnowledgeInput(title: string, text: string): Promise<KnowledgeCategory> {
  const sample = `${title}\n${text}`.trim();
  if (!sample) return "note";
  if (!process.env.NVIDIA_API_KEY || sample.length < 40) {
    return heuristicClassify(sample);
  }

  try {
    const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

    const answer = await withTimeout(
      nvidiaComplete(
        [
          {
            role: "system",
            content:
              "Classify the note below into exactly one word: note, sop, system, or research. " +
              "sop = a step-by-step procedure/process someone follows. system = technical/infrastructure documentation. " +
              "research = findings, analysis, or reference material. note = anything else (ideas, freeform thoughts). " +
              "Reply with only the single lowercase word, nothing else.",
          },
          { role: "user", content: sample.slice(0, 2000) },
        ],
        { maxTokens: 5, temperature: 0 }
      ),
      4000
    );

    const guess = answer.trim().toLowerCase().replace(/[^a-z]/g, "");
    if (VALID.includes(guess as KnowledgeCategory)) return guess as KnowledgeCategory;
    return heuristicClassify(sample);
  } catch {
    return heuristicClassify(sample);
  }
}
