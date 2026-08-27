"use client";

import * as React from "react";

type RowResult = {
  row: Record<string, string>;
  emails: string[];
  method: string | null;
  brief: string | null;
};

export default function CsvDiscoveryPage() {
  const [input, setInput] = React.useState("");
  const [workflowId, setWorkflowId] = React.useState<string | null>(null);
  const [checkId, setCheckId] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [results, setResults] = React.useState<RowResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function poll(id: string) {
    const res = await fetch(`/api/csv-discovery?workflowId=${encodeURIComponent(id)}`);
    const data = await res.json();
    setStatus(data.status ?? "UNKNOWN");
    setResults(data.results ?? []);
    return data.status;
  }

  async function start() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/csv-discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv: input }),
      });
      const data = await res.json();
      if (!res.ok || !data.workflowId) {
        setError(data.error || "failed to start");
        setLoading(false);
        return;
      }
      setWorkflowId(data.workflowId);
      const st = await poll(data.workflowId);
      // Keep polling while running.
      if (st !== "COMPLETED" && st !== "FAILED" && st !== "TERMINATED") {
        const iv = setInterval(async () => {
          const s = await poll(data.workflowId);
          if (s === "COMPLETED" || s === "FAILED" || s === "TERMINATED") clearInterval(iv);
        }, 5000);
      }
    } catch (e: any) {
      setError(e?.message ?? "failed");
    } finally {
      setLoading(false);
    }
  }

  async function checkExisting() {
    if (!checkId.trim()) return;
    setWorkflowId(checkId.trim());
    setLoading(true);
    await poll(checkId.trim());
    setLoading(false);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-label text-lg font-semibold text-ink-strong">Lead Discovery (24/7)</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Paste a CSV of leads (columns like <code>channel</code>, <code>url</code>,{" "}
          <code>company</code>, <code>domain</code>). Each row runs a durable, multi-agent Temporal
          workflow. Research (web/YouTube browse) + DeepSeek brief. And keeps running on the
          server even if you close this tab.
        </p>
      </div>

      <div className="rounded-xl border border-rule bg-card/60 p-4">
        <label className="block text-xs font-medium text-ink-muted">CSV (header row + rows)</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"channel,company\nhttps://youtube.com/@handle,Acme Inc\n,Acme Inc,acme.com"}
          rows={8}
          className="mt-2 w-full rounded-md border border-rule bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={start}
            disabled={loading || !input.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Starting" : "Start durable discovery"}
          </button>
          <div className="flex items-center gap-2">
            <input
              value={checkId}
              onChange={(e) => setCheckId(e.target.value)}
              placeholder="workflowId to check"
              className="w-56 rounded-md border border-rule bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={checkExisting}
              className="rounded-md border border-rule px-3 py-2 text-xs hover:bg-muted"
            >
              Check
            </button>
          </div>
        </div>
        {workflowId && (
          <p className="mt-3 text-xs text-ink-muted">
            Run ID: <code className="text-emerald-400">{workflowId}</code> · status:{" "}
            <b className="text-ink-strong">{status}</b>
          </p>
        )}
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
      </div>

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-card/60 text-left">
                <th className="px-3 py-2 font-label text-ink-muted">Lead</th>
                <th className="px-3 py-2 font-label text-ink-muted">Emails</th>
                <th className="px-3 py-2 font-label text-ink-muted">Method</th>
                <th className="px-3 py-2 font-label text-ink-muted">Brief</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {results.map((r, i) => (
                <tr key={i} className="align-top hover:bg-card/40">
                  <td className="px-3 py-2 text-xs text-ink-muted">
                    {Object.entries(r.row)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    {r.emails.length ? (
                      <div className="space-y-1">
                        {r.emails.map((e) => (
                          <div key={e} className="font-medium text-emerald-500">
                            {e}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-faint"></span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">{r.method ?? ""}</td>
                  <td className="px-3 py-2 max-w-md text-xs text-ink-muted">{r.brief ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
