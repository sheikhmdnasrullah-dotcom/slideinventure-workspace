"use client";

import { useState } from "react";

type Step = { step: number; action: string; detail?: string; observation?: string };

export function BrowseConsole() {
  const [task, setTask] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!task.trim() || running) return;
    setRunning(true);
    setSteps([]);
    setResult("");
    setError("");
    try {
      const res = await fetch("/api/browse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, startUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "request failed");
      } else {
        setSteps(data.steps || []);
        setResult(data.result || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground/60 uppercase">Task</label>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={3}
          placeholder="e.g. Find the contact email on example.com"
          className="rounded-md border border-rule bg-surface px-3 py-2 text-sm"
        />
        <label className="text-xs font-medium text-foreground/60 uppercase">Start URL (optional)</label>
        <input
          value={startUrl}
          onChange={(e) => setStartUrl(e.target.value)}
          placeholder="https://example.com"
          className="rounded-md border border-rule bg-surface px-3 py-2 text-sm"
        />
        <button
          onClick={run}
          disabled={running || !task.trim()}
          className="mt-1 self-start rounded-md bg-[var(--text-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? "Browsing" : "Run browse task"}
        </button>
      </div>

      {steps.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-foreground/60 uppercase">Steps</h2>
          <ol className="space-y-1">
            {steps.map((s) => (
              <li key={s.step} className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm">
                <span className="font-mono text-xs text-[var(--text-accent)]">{s.action}</span>
                {s.detail && <span className="ml-2 text-foreground/60">{s.detail}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-foreground/60 uppercase">Result</h2>
          <div className="whitespace-pre-wrap rounded-md bg-[var(--surface-2)] px-3 py-3 text-sm">{result}</div>
        </div>
      )}

      {error && <p className="text-sm text-[var(--status-danger)]">{error}</p>}
    </div>
  );
}
