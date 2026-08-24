"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ArrowDownToLine,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Upload,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "uploading" | "running" | "completed" | "failed"

interface ResultRow {
  index: number
  email: string
  verdict: string
  checked_at: string
}

interface HistoryJob {
  job_id: string
  filename: string | null
  created_at: string | null
  status: string | null
  total_leads: number | null
  checked_count: number | null
  counts?: {
    summary?: { safe: number; risky: number; invalid: number; error: number }
  }
}

const STORAGE_KEY = "lv_job_id"

// ─── Verdict styling (semantic colors matching the dashboard) ─────────────────

const VERDICT_STYLE: Record<string, { label: string; className: string }> = {
  safe: { label: "Safe", className: "!bg-emerald-500/10 !text-emerald-500 !border-emerald-500/20" },
  risky: { label: "Risky", className: "!bg-amber-500/10 !text-amber-500 !border-amber-500/20" },
  invalid: { label: "Invalid", className: "!bg-red-500/10 !text-red-500 !border-red-500/20" },
  INVALID_FORMAT: { label: "Bad Format", className: "!bg-purple-500/10 !text-purple-500 !border-purple-500/20" },
  error: { label: "Error", className: "!bg-zinc-500/10 !text-zinc-400 !border-zinc-500/20" },
  ERROR: { label: "Error", className: "!bg-zinc-500/10 !text-zinc-400 !border-zinc-500/20" },
  unknown: { label: "Unknown", className: "!bg-zinc-500/10 !text-zinc-400 !border-zinc-500/20" },
}

function verdictStyle(verdict: string) {
  return VERDICT_STYLE[verdict] ?? { label: verdict, className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" }
}

function categoryOf(verdict: string): "safe" | "risky" | "invalid" | "error" {
  switch (verdict) {
    case "safe":
      return "safe"
    case "risky":
      return "risky"
    case "invalid":
    case "INVALID_FORMAT":
      return "invalid"
    default:
      return "error"
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VerificationPanel() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [rows, setRows] = useState<ResultRow[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [history, setHistory] = useState<HistoryJob[]>([])
  const [verdictFilter, setVerdictFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  const rowsRef = useRef<Map<number, ResultRow>>(new Map())
  const esRef = useRef<EventSource | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const PAGE_SIZE = 50

  const addRow = useCallback((r: ResultRow) => {
    rowsRef.current.set(r.index, r)
    setRows(Array.from(rowsRef.current.values()))
  }, [])

  const closeStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  const openStream = useCallback(
    (id: string) => {
      closeStream()
      const es = new EventSource(`/api/lead-verification/stream?jobId=${id}`)
      esRef.current = es
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.status === "done") {
            setPhase("completed")
            closeStream()
          } else if (data.status === "failed") {
            setError(data.error ?? "Verification failed on the server.")
            setPhase("failed")
            closeStream()
          } else if (typeof data.index === "number") {
            addRow({
              index: data.index,
              email: data.email ?? "",
              verdict: data.verdict ?? "unknown",
              checked_at: data.checked_at ?? "",
            })
          }
        } catch {
          /* ignore malformed frames */
        }
      }
      es.onerror = () => {
        // EventSource auto-reconnects; backend replays + resumes.
      }
    },
    [addRow, closeStream]
  )

  const loadHistory = useCallback(() => {
    fetch("/api/lead-verification/jobs")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: HistoryJob[]) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // Reconnect on mount if a job was in progress.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      loadHistory()
      return
    }
    setJobId(saved)
    fetch(`/api/lead-verification/status?jobId=${saved}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.error) {
          localStorage.removeItem(STORAGE_KEY)
          loadHistory()
          return
        }
        if (d.status === "failed") {
          setError(d.error_message ?? "Verification failed on the server.")
          setPhase("failed")
        } else {
          setPhase(d.status === "done" ? "completed" : "running")
          openStream(saved)
        }
      })
      .catch(() => loadHistory())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => closeStream()
  }, [closeStream])

  // Refresh history once a run completes.
  useEffect(() => {
    if (phase === "completed" || phase === "failed") loadHistory()
  }, [phase, loadHistory])

  const startUpload = useCallback(async () => {
    if (!selectedFile) return
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast.error("Only .csv files are accepted")
      return
    }
    setPhase("uploading")
    const form = new FormData()
    form.append("file", selectedFile)
    try {
      const resp = await fetch("/api/lead-verification", { method: "POST", body: form })
      const data = await resp.json()
      if (!resp.ok || !data.job_id) {
        toast.error(data.error ?? "Upload failed")
        setPhase("idle")
        return
      }
      const id: string = data.job_id
      setJobId(id)
      localStorage.setItem(STORAGE_KEY, id)
      rowsRef.current.clear()
      setRows([])
      setPhase("running")
      openStream(id)
    } catch (err) {
      toast.error(`Network error: ${err instanceof Error ? err.message : String(err)}`)
      setPhase("idle")
    }
  }, [selectedFile, openStream])

  const reset = useCallback(() => {
    closeStream()
    localStorage.removeItem(STORAGE_KEY)
    rowsRef.current.clear()
    setRows([])
    setJobId(null)
    setError(null)
    setSelectedFile(null)
    setVerdictFilter("all")
    setSearch("")
    setPage(0)
    setPhase("idle")
  }, [closeStream])

  // ── Derived data ──────────────────────────────────────────────────────────
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.index - a.index),
    [rows]
  )

  const total = rows.length ? Math.max(...rows.map((r) => r.index)) : 0

  const counts = useMemo(() => {
    const c = { safe: 0, risky: 0, invalid: 0, error: 0 }
    for (const r of rows) c[categoryOf(r.verdict)]++
    return c
  }, [rows])

  const percent = total > 0 ? Math.min(100, Math.round((rows.length / total) * 100)) : 0

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return sortedRows.filter((r) => {
      const matchV = verdictFilter === "all" || categoryOf(r.verdict) === verdictFilter
      const matchQ = !q || r.email.toLowerCase().includes(q)
      return matchV && matchQ
    })
  }, [sortedRows, verdictFilter, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Upload */}
      {(phase === "idle" || phase === "uploading") && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Lead CSV</CardTitle>
            <CardDescription>
              Required column: <span className="text-foreground/70">Email</span>. All other
              columns are preserved in the verified output.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div
              onClick={() => phase === "idle" && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                const f = e.dataTransfer.files?.[0]
                if (f) setSelectedFile(f)
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center transition-colors hover:border-primary/40 hover:bg-muted/50",
                drag && "border-primary/60 bg-primary/5",
                phase === "uploading" && "cursor-default"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setSelectedFile(f)
                  e.target.value = ""
                }}
              />
              {phase === "uploading" ? (
                <>
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Uploading &amp; starting job…</p>
                </>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drop your CSV here or <span className="text-primary underline">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground">.csv only · max 50 MB</p>
                </>
              )}
            </div>

            {selectedFile && phase === "idle" && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button onClick={startUpload}>
                  <Upload /> Start Verification
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Running */}
      {phase === "running" && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Running</CardTitle>
            <CardDescription>
              {jobId ? `job ${jobId.slice(0, 8)}…` : ""} · checking leads against Reacher
            </CardDescription>
            <CardAction>
              <Badge variant="outline" className="gap-1.5 !border-emerald-500/30 !text-emerald-500">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Progress value={percent} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {rows.length} / {total || rows.length} checked
                </span>
                <span>{percent}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Safe" value={counts.safe} className="text-emerald-500" />
              <Stat label="Risky" value={counts.risky} className="text-amber-500" />
              <Stat label="Invalid" value={counts.invalid} className="text-red-500" />
              <Stat label="Error" value={counts.error} className="text-zinc-400" />
            </div>

            <LiveTable rows={sortedRows.slice(0, 100)} total={total} />
          </CardContent>
        </Card>
      )}

      {/* Failed */}
      {phase === "failed" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <CircleAlert className="size-4" /> Verification Failed
            </CardTitle>
            <CardDescription>{error ?? "An unrecoverable error occurred on the server."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={reset}>
              Start new job
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Completed */}
      {phase === "completed" && (
        <>
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-emerald-500">Verification Complete</p>
                  <p className="text-xs text-muted-foreground">
                    {total} leads ·{" "}
                    <span className="text-emerald-500">{counts.safe}</span> safe ·{" "}
                    <span className="text-amber-500">{counts.risky}</span> risky ·{" "}
                    <span className="text-red-500">{counts.invalid}</span> invalid ·{" "}
                    <span className="text-zinc-400">{counts.error}</span> error
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {jobId && (
                  <Button variant="default" render={<a href={`/api/lead-verification/download?jobId=${jobId}`} />}>
                    <ArrowDownToLine /> Download Results
                  </Button>
                )}
                <Button variant="outline" onClick={reset}>
                  New job
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Search email…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                  className="h-8 w-44 text-xs"
                />
                <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                  {[
                    { key: "all", label: "All" },
                    { key: "safe", label: "Safe" },
                    { key: "risky", label: "Risky" },
                    { key: "invalid", label: "Invalid" },
                    { key: "error", label: "Error" },
                  ].map((f) => (
                    <Button
                      key={f.key}
                      size="xs"
                      variant={verdictFilter === f.key ? "default" : "ghost"}
                      onClick={() => {
                        setVerdictFilter(f.key)
                        setPage(0)
                      }}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No results match the current filter.
                </p>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead className="w-[60px]">#</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Verdict</TableHead>
                          <TableHead>Checked At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((r) => {
                          const s = verdictStyle(r.verdict)
                          return (
                            <TableRow key={r.index}>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {r.index}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{r.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("border", s.className)}>
                                  {s.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.checked_at ? new Date(r.checked_at).toLocaleString() : "—"}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {pageCount > 1 && (
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {filtered.length} results · page {currentPage + 1} of {pageCount}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={currentPage === 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          Prev
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={currentPage >= pageCount - 1}
                          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* History (when not actively running) */}
      {phase !== "running" && <HistoryCard jobs={history} onChanged={loadHistory} />}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label.toUpperCase()}</p>
      <p className={cn("text-xl font-semibold", className)}>{value}</p>
    </div>
  )
}

function LiveTable({ rows, total }: { rows: ResultRow[]; total: number }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Verdict</TableHead>
            <TableHead>Checked At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                Waiting for first result…
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const s = verdictStyle(r.verdict)
              return (
                <TableRow key={r.index}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.index}</TableCell>
                  <TableCell className="font-mono text-sm">{r.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("border", s.className)}>
                      {s.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.checked_at ? new Date(r.checked_at).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      {total > rows.length && (
        <p className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Showing {rows.length} most recent of {total} checked.
        </p>
      )}
    </div>
  )
}

function HistoryCard({ jobs, onChanged }: { jobs: HistoryJob[]; onChanged?: () => void }) {
  if (!jobs.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Job History</CardTitle>
        {onChanged && (
          <CardAction>
            <Button size="xs" variant="ghost" onClick={onChanged}>
              Refresh
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Checked</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => {
                const summary = j.counts?.summary
                return (
                  <TableRow key={j.job_id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {j.filename ?? j.job_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {j.created_at ? new Date(j.created_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border",
                          j.status === "done"
                            ? "!bg-emerald-500/10 !text-emerald-500 !border-emerald-500/20"
                            : j.status === "failed"
                              ? "!bg-red-500/10 !text-red-500 !border-red-500/20"
                              : "!bg-amber-500/10 !text-amber-500 !border-amber-500/20"
                        )}
                      >
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {j.checked_count ?? 0}
                      {summary ? (
                        <span className="ml-2 text-emerald-500">{summary.safe}</span>
                      ) : null}
                      {summary ? <span className="ml-1 text-amber-500">{summary.risky}</span> : null}
                      {summary ? <span className="ml-1 text-red-500">{summary.invalid}</span> : null}
                      {summary ? <span className="ml-1 text-zinc-400">{summary.error}</span> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="xs" variant="outline" render={<a href={`/api/lead-verification/download?jobId=${j.job_id}`} />}>
                        <ArrowDownToLine /> CSV
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
