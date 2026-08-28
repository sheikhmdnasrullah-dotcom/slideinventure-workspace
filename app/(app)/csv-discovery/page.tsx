"use client";

import * as React from "react";
import Papa from "papaparse";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";

type RowResult = {
  row: Record<string, string>;
  emails: string[];
  method: string | null;
  brief: string | null;
};

type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

/** Mirrors the server-side cap in app/api/csv-discovery/route.ts. */
const MAX_ROWS = 200;

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "TERMINATED"]);

/**
 * PapaParse handles quoted commas, ragged rows and CRLF, which a naive
 * `line.split(",")` does not. Parsing here and posting `rows` means a company
 * name like `"Acme, Inc"` survives instead of being split into two columns.
 */
function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });

  const headers = (result.meta.fields ?? []).filter(Boolean);
  const rows = result.data.filter((row) =>
    Object.values(row).some((value) => (value ?? "").toString().trim())
  );

  return { headers, rows };
}

export default function CsvDiscoveryPage() {
  const [input, setInput] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [parsed, setParsed] = React.useState<ParsedCsv | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const [workflowId, setWorkflowId] = React.useState<string | null>(null);
  const [checkId, setCheckId] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [results, setResults] = React.useState<RowResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pollTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = React.useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // A discovery run outlives this component, so the interval has to be torn down
  // on unmount or navigating away leaks a timer that keeps setting state.
  React.useEffect(() => stopPolling, [stopPolling]);

  const poll = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/csv-discovery?workflowId=${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => ({}));
    setStatus(data.status ?? "UNKNOWN");
    setResults(Array.isArray(data.results) ? data.results : []);
    return data.status as string | undefined;
  }, []);

  const startPolling = React.useCallback(
    (id: string) => {
      stopPolling();
      pollTimer.current = setInterval(async () => {
        try {
          const next = await poll(id);
          if (next && TERMINAL_STATUSES.has(next)) stopPolling();
        } catch {
          // Transient gateway hiccup: keep polling rather than killing the run view.
        }
      }, 5000);
    },
    [poll, stopPolling]
  );

  const acceptFile = React.useCallback((selected: File) => {
    const isCsv =
      selected.name.toLowerCase().endsWith(".csv") ||
      selected.type.includes("csv") ||
      selected.type === "text/plain";

    if (!isCsv) {
      setError("Please choose a .csv file");
      return;
    }

    setError(null);
    Papa.parse<Record<string, string>>(selected, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete(results) {
        const headers = (results.meta.fields ?? []).filter(Boolean);
        const rows = results.data.filter((row) =>
          Object.values(row).some((value) => (value ?? "").toString().trim())
        );

        if (headers.length === 0) {
          setError(`${selected.name} has no header row`);
          return;
        }
        if (rows.length === 0) {
          setError(`${selected.name} has a header row but no data rows`);
          return;
        }

        setFile(selected);
        setParsed({ headers, rows });
        setInput("");
      },
      error() {
        setError(`Could not read ${selected.name}`);
      },
    });
  }, []);

  const clearFile = React.useCallback(() => {
    setFile(null);
    setParsed(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Whichever input the user actually used is what gets submitted.
  const pendingRows = React.useMemo(() => {
    if (parsed) return parsed.rows;
    if (!input.trim()) return [];
    return parseCsvText(input).rows;
  }, [parsed, input]);

  const canStart = pendingRows.length > 0 && !loading;
  const truncated = pendingRows.length > MAX_ROWS;

  async function start() {
    if (!canStart) return;
    setLoading(true);
    setError(null);
    stopPolling();
    try {
      const res = await fetch("/api/csv-discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Send parsed rows rather than raw text: the route accepts either, and
        // rows skip its simpler server-side comma splitter entirely.
        body: JSON.stringify({ rows: pendingRows.slice(0, MAX_ROWS) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.workflowId) {
        setError(data.error || "Failed to start discovery");
        return;
      }
      setWorkflowId(data.workflowId);
      const first = await poll(data.workflowId);
      if (!first || !TERMINAL_STATUSES.has(first)) startPolling(data.workflowId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start discovery");
    } finally {
      setLoading(false);
    }
  }

  async function checkExisting() {
    const id = checkId.trim();
    if (!id) return;
    setWorkflowId(id);
    setLoading(true);
    setError(null);
    try {
      const current = await poll(id);
      if (!current || !TERMINAL_STATUSES.has(current)) startPolling(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that run");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-label text-lg font-semibold text-ink-strong">Lead Discovery (24/7)</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Upload or paste a CSV of leads (columns like <code>channel</code>, <code>url</code>,{" "}
          <code>company</code>, <code>domain</code>). Each row runs a durable, multi-agent Temporal
          workflow. Research (web/YouTube browse) + DeepSeek brief. And keeps running on the server
          even if you close this tab.
        </p>
      </div>

      <div className="rounded-xl border border-rule bg-card/60 p-4">
        <label className="block text-xs font-medium text-ink-muted">Upload a CSV file</label>

        <input
          ref={fileInputRef}
          id="csv-discovery-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) acceptFile(selected);
          }}
        />

        {file && parsed ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2.5">
            <FileSpreadsheet className="size-4 shrink-0 text-emerald-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-strong">{file.name}</p>
              <p className="text-xs text-ink-muted">
                {(file.size / 1024).toFixed(1)} KB · {parsed.rows.length}{" "}
                {parsed.rows.length === 1 ? "row" : "rows"} · {parsed.headers.length}{" "}
                {parsed.headers.length === 1 ? "column" : "columns"}
              </p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              aria-label="Remove file"
              className="inline-flex items-center gap-1 rounded-md border border-rule px-2 py-1 text-xs text-ink-muted hover:bg-muted"
            >
              <X className="size-3" /> Remove
            </button>
          </div>
        ) : (
          <label
            htmlFor="csv-discovery-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) acceptFile(dropped);
            }}
            className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-rule hover:border-ink-faint hover:bg-muted/40"
            }`}
          >
            <UploadCloud className="size-6 text-ink-muted" />
            <span className="text-sm font-medium text-ink-strong">
              Click to choose a CSV file
            </span>
            <span className="text-xs text-ink-muted">or drag and drop it here</span>
          </label>
        )}

        {parsed && parsed.headers.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-ink-muted">Detected columns</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {parsed.headers.map((header) => (
                <span
                  key={header}
                  className="rounded-sm border border-rule bg-background px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
                >
                  {header}
                </span>
              ))}
            </div>

            <div className="mt-3 overflow-x-auto rounded-md border border-rule">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-rule bg-card/60 text-left">
                    {parsed.headers.map((header) => (
                      <th key={header} className="px-2.5 py-1.5 font-label text-ink-muted">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {parsed.headers.map((header) => (
                        <td key={header} className="px-2.5 py-1.5 text-ink-muted">
                          {row[header] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.rows.length > 5 && (
              <p className="mt-1.5 text-xs text-ink-faint">
                Showing 5 of {parsed.rows.length} rows.
              </p>
            )}
          </div>
        )}

        {!file && (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-rule" />
              <span className="text-xs text-ink-faint">or paste it</span>
              <div className="h-px flex-1 bg-rule" />
            </div>

            <label className="block text-xs font-medium text-ink-muted">
              CSV (header row + rows)
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"channel,company\nhttps://youtube.com/@handle,Acme Inc\n,Acme Inc,acme.com"}
              rows={8}
              className="mt-2 w-full rounded-md border border-rule bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </>
        )}

        {truncated && (
          <p className="mt-3 text-xs text-amber-500">
            {pendingRows.length} rows detected. Only the first {MAX_ROWS} will be queued.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={start}
            disabled={!canStart}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {loading
              ? "Starting"
              : pendingRows.length > 0
                ? `Start durable discovery (${Math.min(pendingRows.length, MAX_ROWS)})`
                : "Start durable discovery"}
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
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">{r.method ?? "—"}</td>
                  <td className="px-3 py-2 max-w-md text-xs text-ink-muted">{r.brief ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
