"use client";

import { useEffect, useRef, useState, useCallback, DragEvent } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = "idle" | "uploading" | "running" | "completed" | "failed";

interface VerdictCounts {
  [verdict: string]: number;
}

interface JobState {
  jobId: string;
  supabaseJobId: string;
  status: JobStatus;
  totalLeads: number;
  checkedCount: number;
  verdictCounts: VerdictCounts;
  errorMessage?: string;
}

interface ResultRow {
  [key: string]: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "lead_verification_job";
const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  safe:       { label: "Safe",      color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  risky:      { label: "Risky",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  invalid:    { label: "Invalid",   color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  unknown:    { label: "Unknown",   color: "#6b7280", bg: "rgba(107,114,128,0.12)"},
  ERROR:      { label: "Error",     color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  INVALID_FORMAT: { label: "Bad Format", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
};

function getVerdictStyle(verdict: string) {
  return VERDICT_CONFIG[verdict] ?? { label: verdict, color: "#94a3b8", bg: "rgba(148,163,184,0.12)" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCSV(text: string): ResultRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    // Simple CSV parse (handles quoted fields with commas)
    const vals: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
      else { cur += ch; }
    }
    vals.push(cur);
    const row: ResultRow = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return row;
  });
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  const cfg = getVerdictStyle(verdict);
  return (
    <span style={{
      fontSize: "0.7rem",
      fontFamily: "'DM Mono', monospace",
      fontWeight: 600,
      letterSpacing: "0.04em",
      padding: "2px 8px",
      borderRadius: "4px",
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
      textTransform: "uppercase",
    }}>
      {cfg.label}
    </span>
  );
}

function BoolBadge({ value }: { value: string }) {
  const isTrue = value === "true" || value === "True";
  const isUnknown = value === "unknown" || value === "n/a" || value === "";
  const color = isUnknown ? "#6b7280" : isTrue ? "#ef4444" : "#10b981";
  const label = isUnknown ? "—" : isTrue ? "yes" : "no";
  return (
    <span style={{
      fontSize: "0.7rem",
      fontFamily: "'DM Mono', monospace",
      color,
      fontWeight: 500,
    }}>
      {label}
    </span>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        position: "absolute",
        top: 0, left: 0,
        height: "100%",
        width: `${pct}%`,
        background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
        borderRadius: 3,
        transition: "width 0.4s ease",
        boxShadow: "0 0 12px rgba(245,158,11,0.5)",
      }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VerificationPanel() {
  const [phase, setPhase] = useState<JobStatus>("idle");
  const [job, setJob] = useState<JobState | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [search, setSearch] = useState("");
  const [filterVerdict, setFilterVerdict] = useState("all");
  const [drag, setDrag] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<ReturnType<typeof createClient> | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 50;

  // ── Realtime subscription ──────────────────────────────────────────────────
  const subscribeToJob = useCallback((supabaseJobId: string) => {
    const sb = createClient();
    realtimeRef.current = sb;
    const ch = sb
      .channel(`verification_job_${supabaseJobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "verification_jobs",
          filter: `id=eq.${supabaseJobId}`,
        },
        (payload) => {
          const row = payload.new as {
            status: string;
            checked_count: number;
            total_leads: number;
            verdict_counts: VerdictCounts;
            error_message: string | null;
          };
          setJob((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: row.status as JobStatus,
              checkedCount: row.checked_count,
              totalLeads: row.total_leads ?? prev.totalLeads,
              verdictCounts: row.verdict_counts ?? {},
              errorMessage: row.error_message ?? undefined,
            };
          });
          setPhase(row.status as JobStatus);
          if (row.status === "completed" || row.status === "failed") {
            stopTimer();
          }
        }
      )
      .subscribe();
    channelRef.current = ch;
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const startTimer = () => {
    startTimeRef.current = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed(Date.now() - (startTimeRef.current ?? Date.now()));
    }, 1000);
  };
  const stopTimer = () => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  };

  // ── Restore job from localStorage on mount ────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const saved: JobState = JSON.parse(stored);
      if (!saved.supabaseJobId) return;

      // Fetch current state from Supabase
      const sb = createClient();
      sb.from("verification_jobs")
        .select("*")
        .eq("id", saved.supabaseJobId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) return;
          const restoredJob: JobState = {
            ...saved,
            status: data.status as JobStatus,
            checkedCount: data.checked_count,
            totalLeads: data.total_leads ?? saved.totalLeads,
            verdictCounts: data.verdict_counts ?? {},
            errorMessage: data.error_message ?? undefined,
          };
          setJob(restoredJob);
          setPhase(data.status as JobStatus);
          if (data.status === "running") {
            startTimer();
            subscribeToJob(saved.supabaseJobId);
          }
        });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [subscribeToJob]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopTimer();
      if (channelRef.current && realtimeRef.current) {
        realtimeRef.current.removeChannel(channelRef.current);
      }
    };
  }, []);

  // ── Fetch results CSV when completed ─────────────────────────────────────
  useEffect(() => {
    if (phase !== "completed" || !job?.jobId) return;
    fetch(`/api/lead-verification/download?jobId=${job.jobId}`)
      .then((r) => r.text())
      .then((csv) => setResults(parseCSV(csv)))
      .catch(() => {}); // UI shows download button as fallback
  }, [phase, job?.jobId]);

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Only .csv files are accepted");
      return;
    }
    setUploadError(null);
    setPhase("uploading");

    const form = new FormData();
    form.append("file", file);

    try {
      const resp = await fetch("/api/lead-verification", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) {
        setUploadError(data.error ?? "Upload failed");
        setPhase("idle");
        return;
      }

      const newJob: JobState = {
        jobId: data.job_id,
        supabaseJobId: data.supabase_job_id ?? "",
        status: "running",
        totalLeads: data.total_leads ?? 0,
        checkedCount: 0,
        verdictCounts: {},
      };
      setJob(newJob);
      setPhase("running");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newJob));
      startTimer();

      if (newJob.supabaseJobId) {
        subscribeToJob(newJob.supabaseJobId);
      }
    } catch (err) {
      setUploadError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("idle");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const reset = () => {
    stopTimer();
    if (channelRef.current && realtimeRef.current) {
      realtimeRef.current.removeChannel(channelRef.current);
    }
    setPhase("idle");
    setJob(null);
    setResults([]);
    setSearch("");
    setFilterVerdict("all");
    setElapsed(0);
    setUploadError(null);
    setPage(0);
    localStorage.removeItem(STORAGE_KEY);
  };

  // ── Filtered results ───────────────────────────────────────────────────────
  const allVerdicts = Array.from(new Set(results.map((r) => r.verdict).filter(Boolean)));
  const filtered = results.filter((r) => {
    const q = search.toLowerCase();
    const matchQ = !q || (r.email ?? "").toLowerCase().includes(q) ||
      (r.first_name ?? "").toLowerCase().includes(q) ||
      (r.last_name ?? "").toLowerCase().includes(q) ||
      (r.Email ?? "").toLowerCase().includes(q);
    const matchV = filterVerdict === "all" || r.verdict === filterVerdict;
    return matchQ && matchV;
  });
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "24px",
  };

  const statBox: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: "12px 16px",
    flex: 1,
    minWidth: 100,
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;500;600;700&display=swap');

        .lv-dropzone {
          transition: border-color 0.2s, background 0.2s, transform 0.15s;
        }
        .lv-dropzone:hover, .lv-dropzone.drag {
          border-color: rgba(245,158,11,0.5) !important;
          background: rgba(245,158,11,0.04) !important;
          transform: translateY(-1px);
        }
        .lv-input:focus {
          outline: none;
          border-color: rgba(245,158,11,0.4) !important;
          box-shadow: 0 0 0 3px rgba(245,158,11,0.08);
        }
        .lv-select:focus {
          outline: none;
          border-color: rgba(245,158,11,0.4) !important;
        }
        .lv-row:hover td {
          background: rgba(255,255,255,0.02);
        }
        .lv-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .lv-btn:active { transform: translateY(0); }
        .lv-btn { transition: opacity 0.15s, transform 0.15s; }
        @keyframes pulse-bar {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .lv-spinner { animation: spin 0.8s linear infinite; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>

        {/* ── IDLE: Upload dropzone ─────────────────────────────────────── */}
        {(phase === "idle" || phase === "uploading") && (
          <div style={card}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "1.05rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}>
                Upload Lead CSV
              </h2>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                Required column: <span style={{ color: "#f59e0b" }}>Email</span>. Additional columns are preserved in output.
              </p>
            </div>

            <div
              className={`lv-dropzone${drag ? " drag" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => phase === "idle" && fileInputRef.current?.click()}
              style={{
                border: "1px dashed rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "48px 24px",
                textAlign: "center",
                cursor: phase === "uploading" ? "default" : "pointer",
                position: "relative",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={onFileChange}
              />

              {phase === "uploading" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div className="lv-spinner" style={{
                    width: 28, height: 28,
                    border: "2px solid rgba(245,158,11,0.2)",
                    borderTop: "2px solid #f59e0b",
                    borderRadius: "50%",
                  }} />
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8rem", color: "#f59e0b" }}>
                    Uploading &amp; starting job…
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: "0.9rem", color: "rgba(255,255,255,0.6)", margin: 0 }}>
                    Drop your CSV here or <span style={{ color: "#f59e0b", textDecoration: "underline" }}>browse</span>
                  </p>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                    .csv only · max 50 MB
                  </p>
                </>
              )}
            </div>

            {uploadError && (
              <div style={{
                marginTop: 12, padding: "10px 14px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8,
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.76rem",
                color: "#ef4444",
              }}>
                ⚠ {uploadError}
              </div>
            )}
          </div>
        )}

        {/* ── RUNNING: Live progress ────────────────────────────────────── */}
        {phase === "running" && job && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.05rem", fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: 0 }}>
                  Verification Running
                </h2>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                  job: {job.jobId.slice(0, 8)}…
                </p>
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.8rem",
                color: "#f59e0b",
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 6,
                padding: "4px 12px",
                animation: "pulse-bar 2s ease-in-out infinite",
              }}>
                ● LIVE
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 16 }}>
              <ProgressBar value={job.checkedCount} total={job.totalLeads} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>
                  {job.checkedCount} / {job.totalLeads} checked
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>
                  {job.totalLeads > 0 ? Math.round((job.checkedCount / job.totalLeads) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
              <div style={statBox}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>ELAPSED</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1rem", fontWeight: 500, color: "#f59e0b" }}>
                  {formatDuration(elapsed)}
                </div>
              </div>
              <div style={statBox}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>REMAINING</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1rem", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
                  {Math.max(0, job.totalLeads - job.checkedCount)}
                </div>
              </div>
              {Object.entries(job.verdictCounts).map(([verdict, count]) => {
                const cfg = getVerdictStyle(verdict);
                return (
                  <div key={verdict} style={{ ...statBox }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.65rem", color: cfg.color, marginBottom: 4, textTransform: "uppercase" }}>
                      {cfg.label}
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1rem", fontWeight: 500, color: cfg.color }}>
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>

            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.25)" }}>
              This page will update automatically. You can safely close and return — progress is persisted.
            </p>
          </div>
        )}

        {/* ── FAILED: Error state ───────────────────────────────────────── */}
        {phase === "failed" && job && (
          <div style={{ ...card, borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.05rem", fontWeight: 600, color: "#ef4444", margin: "0 0 8px 0" }}>
              Verification Failed
            </h2>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
              {job.errorMessage ?? "An unrecoverable error occurred on the verification server."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="lv-btn" onClick={reset} style={{
                fontFamily: "'DM Mono', monospace", fontSize: "0.78rem",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6, padding: "8px 16px", color: "rgba(255,255,255,0.7)", cursor: "pointer",
              }}>
                ← Start new job
              </button>
            </div>
          </div>
        )}

        {/* ── COMPLETED: Results table ──────────────────────────────────── */}
        {phase === "completed" && job && (
          <>
            {/* Summary bar */}
            <div style={{ ...card, padding: "16px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: "0.95rem", color: "#10b981" }}>
                    ✓ Verification Complete
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginLeft: 12 }}>
                    {job.totalLeads} leads · {formatDuration(elapsed)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {Object.entries(job.verdictCounts).map(([v, c]) => {
                    const cfg = getVerdictStyle(v);
                    return (
                      <span key={v} style={{
                        fontFamily: "'DM Mono', monospace", fontSize: "0.72rem",
                        padding: "3px 10px", borderRadius: 4,
                        color: cfg.color, background: cfg.bg,
                        border: `1px solid ${cfg.color}33`,
                      }}>
                        {cfg.label}: {c}
                      </span>
                    );
                  })}
                  <button
                    className="lv-btn"
                    onClick={() => { window.location.href = `/api/lead-verification/download?jobId=${job.jobId}`; }}
                    style={{
                      fontFamily: "'DM Mono', monospace", fontSize: "0.75rem",
                      background: "#f59e0b", border: "none",
                      borderRadius: 6, padding: "6px 14px",
                      color: "#000", fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    ↓ Download CSV
                  </button>
                  <button className="lv-btn" onClick={reset} style={{
                    fontFamily: "'DM Mono', monospace", fontSize: "0.75rem",
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6, padding: "6px 14px", color: "rgba(255,255,255,0.6)", cursor: "pointer",
                  }}>
                    New job
                  </button>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="lv-input"
                type="text"
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                style={{
                  fontFamily: "'DM Mono', monospace", fontSize: "0.8rem",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7, padding: "8px 14px", color: "rgba(255,255,255,0.8)",
                  flex: 1, minWidth: 200,
                }}
              />
              <select
                className="lv-select"
                value={filterVerdict}
                onChange={(e) => { setFilterVerdict(e.target.value); setPage(0); }}
                style={{
                  fontFamily: "'DM Mono', monospace", fontSize: "0.78rem",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7, padding: "8px 14px", color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                }}
              >
                <option value="all">All verdicts ({results.length})</option>
                {allVerdicts.map((v) => (
                  <option key={v} value={v}>
                    {getVerdictStyle(v).label} ({results.filter((r) => r.verdict === v).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Results table */}
            {results.length > 0 ? (
              <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Name", "Email", "Verdict", "Disposable", "Role Acct", "Catch-all"].map((h) => (
                          <th key={h} style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: "0.65rem",
                            fontWeight: 500,
                            letterSpacing: "0.06em",
                            color: "rgba(255,255,255,0.3)",
                            textTransform: "uppercase",
                            padding: "12px 16px",
                            textAlign: "left",
                            background: "rgba(0,0,0,0.15)",
                            whiteSpace: "nowrap",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((row, i) => {
                        const email = row.email ?? row.Email ?? "";
                        const firstName = row.first_name ?? row["First Name"] ?? row.FirstName ?? "";
                        const lastName = row.last_name ?? row["Last Name"] ?? row.LastName ?? "";
                        const name = [firstName, lastName].filter(Boolean).join(" ") || "—";
                        return (
                          <tr
                            key={`${email}-${i}`}
                            className="lv-row"
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                          >
                            <td style={{ padding: "10px 16px" }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8rem", color: "rgba(255,255,255,0.65)" }}>
                                {name}
                              </span>
                            </td>
                            <td style={{ padding: "10px 16px" }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>
                                {email}
                              </span>
                            </td>
                            <td style={{ padding: "10px 16px" }}>
                              <VerdictBadge verdict={row.verdict ?? "unknown"} />
                            </td>
                            <td style={{ padding: "10px 16px" }}>
                              <BoolBadge value={row.is_disposable ?? ""} />
                            </td>
                            <td style={{ padding: "10px 16px" }}>
                              <BoolBadge value={row.is_role_account ?? ""} />
                            </td>
                            <td style={{ padding: "10px 16px" }}>
                              <BoolBadge value={row.is_catch_all ?? ""} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>
                      {filtered.length} results · page {page + 1} of {totalPages}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="lv-btn"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                        style={{
                          fontFamily: "'DM Mono', monospace", fontSize: "0.75rem",
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 5, padding: "5px 12px", color: "rgba(255,255,255,0.5)",
                          cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.4 : 1,
                        }}
                      >
                        ← prev
                      </button>
                      <button
                        className="lv-btn"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                        style={{
                          fontFamily: "'DM Mono', monospace", fontSize: "0.75rem",
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 5, padding: "5px 12px", color: "rgba(255,255,255,0.5)",
                          cursor: page >= totalPages - 1 ? "default" : "pointer",
                          opacity: page >= totalPages - 1 ? 0.4 : 1,
                        }}
                      >
                        next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ ...card, textAlign: "center", padding: "32px" }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>
                  Loading results… or{" "}
                  <a
                    href={`/api/lead-verification/download?jobId=${job.jobId}`}
                    style={{ color: "#f59e0b", textDecoration: "underline", cursor: "pointer" }}
                  >
                    download CSV directly
                  </a>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
