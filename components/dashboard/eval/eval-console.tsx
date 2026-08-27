"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Metric = { score: number; reason: string };
type EvalResult = {
  ok: boolean;
  faithfulness: Metric;
  answerRelevancy: Metric;
  contextRelevancy: Metric;
  answer: string;
  error?: string;
};

function Bar({ label, m }: { label: string; m: Metric }) {
  const pct = Math.round(m.score * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/70">{label}</span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div className="h-full bg-[var(--text-accent)]" style={{ width: `${pct}%` }} />
      </div>
      {m.reason && <p className="text-xs text-foreground/40">{m.reason}</p>}
    </div>
  );
}

const SAMPLES = [
  "How do I connect a mailbox to the workspace?",
  "What integrations are supported?",
  "Summarize the research on agentic workflows",
];

export function EvalConsole() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);

  async function run() {
    if (!query.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/eval/rag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "eval failed");
      setResult(data);
    } catch (e) {
      setResult({ ok: false, faithfulness: { score: 0, reason: "" }, answerRelevancy: { score: 0, reason: "" }, contextRelevancy: { score: 0, reason: "" }, answer: "", error: e instanceof Error ? e.message : "eval failed" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={3}
        placeholder="Question to evaluate against retrieved knowledge"
      />
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            onClick={() => setQuery(s)}
            className="rounded-full border border-rule px-3 py-1 text-xs text-foreground/60 hover:bg-surface-2"
          >
            {s}
          </button>
        ))}
      </div>
      <Button onClick={run} disabled={running || !query.trim()} className="self-start">
        {running ? "Evaluating" : "Run RAG eval"}
      </Button>

      {result && (
        <div className="flex flex-col gap-4 rounded-md border border-rule bg-surface p-4">
          {result.error ? (
            <p className="text-sm text-[var(--status-danger)]">{result.error}</p>
          ) : (
            <>
              <Bar label="Faithfulness" m={result.faithfulness} />
              <Bar label="Answer relevancy" m={result.answerRelevancy} />
              <Bar label="Context relevancy" m={result.contextRelevancy} />
              <div>
                <p className="text-xs font-medium uppercase text-foreground/50">Generated answer</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{result.answer}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
