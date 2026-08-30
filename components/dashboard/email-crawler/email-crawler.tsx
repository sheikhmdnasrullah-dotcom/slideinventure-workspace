"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  Search,
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Circle,
  ChevronRight,
  FolderArchive,
  Download,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  RefreshCw,
  Globe,
  Upload,
  FileSpreadsheet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

type Verdict = "valid" | "invalid" | "unknown" | "error";
type StepStatus = "success" | "empty" | "error" | "skipped";

type TrailStep = {
  agent: string;
  label: string;
  status: StepStatus;
  detail?: string;
};

type SavedProspect = {
  id: string;
  channel: string;
  channelName: string;
  emails: string[];
  websites: string[];
  method: string | null;
  researchedAt: string;
};

const VERDICT_STYLE: Record<Verdict, string> = {
  valid: "!bg-emerald-500/10 !text-emerald-500 !border-emerald-500/20",
  invalid: "!bg-red-500/10 !text-red-500 !border-red-500/20",
  unknown: "!bg-zinc-500/10 !text-zinc-400 !border-zinc-500/20",
  error: "!bg-amber-500/10 !text-amber-500 !border-amber-500/20",
};

const STEP_ICON: Record<StepStatus, typeof CheckCircle2> = {
  success: CheckCircle2,
  empty: MinusCircle,
  error: XCircle,
  skipped: Circle,
};

const STEP_STYLE: Record<StepStatus, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  empty: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  error: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  skipped: "border-border/50 bg-background/40 text-foreground/30",
};

function AgentPipeline({ trail }: { trail: TrailStep[] }) {
  const winner = trail.find((s) => s.status === "success");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" /> Agent Pipeline
        </CardTitle>
        <CardDescription>
          {winner
            ? `Found by ${winner.label}. Every agent before it handed off automatically instead of giving up.`
            : "Each agent hands off to the next on failure or a dead end — the pipeline only stops once every agent has had a turn."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-1.5">
          {trail.map((step, i) => {
            const Icon = STEP_ICON[step.status];
            return (
              <span key={step.agent} className="flex items-center gap-1.5">
                <span
                  title={step.detail || step.status}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${STEP_STYLE[step.status]}`}
                >
                  <Icon className="size-3.5" />
                  {step.label}
                </span>
                {i < trail.length - 1 && (
                  <ChevronRight className="size-3.5 text-foreground/20" />
                )}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

type BatchRowStatus = "pending" | "running" | "done" | "error";

type BatchRow = {
  index: number;
  input: Record<string, string>;
  detectedType: string;
  detectedLink: string | null;
  status: BatchRowStatus;
  emails: string[];
  verdicts: string[];
  agent: string | null;
  error: string | null;
};

type Batch = {
  id: string;
  filename: string;
  status: BatchRowStatus;
  total: number;
  completed: number;
  rows: BatchRow[];
};

const POLL_MS = 4000;

function BulkCsvImport() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/email-crawler/batch/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setBatch(data);
    } catch {
      // next poll tick will retry
    }
  }, []);

  useEffect(() => {
    if (!batch || batch.status === "done") return;
    const id = batch.id;
    const interval = setInterval(() => poll(id), POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the id/status pairing should restart the interval
  }, [batch?.id, batch?.status, poll]);

  async function upload() {
    if (!file) {
      toast.error("Choose a CSV file first");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/email-crawler/batch", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }
      toast.success(
        `Processing ${data.total} row(s)${data.truncated ? ` (capped at ${data.maxRows})` : ""} — five agents run per row`
      );
      await poll(data.batchId);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const found = batch?.rows.filter((r) => r.status === "done" && r.emails.length).length ?? 0;
  const notFound = batch?.rows.filter((r) => r.status === "done" && !r.emails.length).length ?? 0;
  const errored = batch?.rows.filter((r) => r.status === "error").length ?? 0;
  const pct = batch && batch.total ? Math.round((batch.completed / batch.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="size-4" /> Bulk CSV Import
        </CardTitle>
        <CardDescription>
          Upload a CSV of leads — any mix of YouTube channels, LinkedIn/Facebook/Instagram links, plain
          websites, or just names — and it&apos;s smartly analyzed row by row: the same five-agent pipeline
          runs per prospect, verifies every hit with Reacher, and gives back a CSV with an email column
          added. Up to 100 rows per upload.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs text-foreground/60 file:mr-3 file:rounded-md file:border file:border-border/50 file:bg-background/40 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
          />
          <Button onClick={upload} disabled={uploading || !file} size="sm">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Uploading…" : "Upload & find emails"}
          </Button>
        </div>

        {batch && (
          <div className="flex flex-col gap-3 rounded-md border border-border/50 bg-background/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium">{batch.filename}</span>
              <span className="text-foreground/50">
                {batch.completed}/{batch.total} processed
                {batch.status !== "done" && " — keep this tab open to keep it moving"}
              </span>
            </div>
            <Progress value={pct} />
            <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60">
              <span className="text-emerald-500">{found} found</span>
              <span>{notFound} not found</span>
              {errored > 0 && <span className="text-amber-500">{errored} errored</span>}
              <span>{Math.max(batch.total - batch.completed, 0)} pending</span>
            </div>
            <a
              href={`/api/email-crawler/batch/${batch.id}/download`}
              className={buttonVariants({ variant: "outline", size: "sm" }) + " self-start gap-2"}
            >
              <Download className="size-3.5" />
              {batch.status === "done" ? "Download CSV" : "Download CSV (partial)"}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EmailCrawler() {
  const [link, setLink] = useState("");
  const [details, setDetails] = useState("");
  const [instructions, setInstructions] = useState("");
  const [running, setRunning] = useState(false);
  const [raw, setRaw] = useState("");
  const [trail, setTrail] = useState<TrailStep[]>([]);
  const [results, setResults] = useState<
    { email: string; source: string; verdict: Verdict; leadId?: string | null }[]
  >([]);
  const [imported, setImported] = useState(0);

  // Saved research files (populated whenever a YouTube channel is the source —
  // every other source is imported straight into Leads instead).
  const [filesOpen, setFilesOpen] = useState(false);
  const [savedProspects, setSavedProspects] = useState<SavedProspect[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadSavedProspects = useCallback(async () => {
    try {
      setFilesLoading(true);
      const res = await fetch("/api/youtube-email/saved");
      if (res.ok) {
        const data = await res.json();
        setSavedProspects(data.prospects || []);
      }
    } catch {
      // silent
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fetch on mount
    loadSavedProspects();
  }, [loadSavedProspects]);

  const run = useCallback(async () => {
    if (!link.trim() && !details.trim()) {
      toast.error("Give a link or prospect details");
      return;
    }
    setRunning(true);
    setResults([]);
    setRaw("");
    setTrail([]);
    try {
      const resp = await fetch("/api/email-crawler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link, details, instructions }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data.error || "Crawl failed");
        return;
      }
      setResults(data.emails);
      setImported(data.imported);
      setRaw(data.raw || "");
      setTrail(data.trail || []);
      if (data.emails.length) {
        toast.success(`Found ${data.emails.length} email(s), ${data.imported} imported as leads`);
      } else {
        toast.info("All agents tried — no verifiable email found");
      }
      loadSavedProspects();
    } catch {
      toast.error("Crawl failed");
    } finally {
      setRunning(false);
    }
  }, [link, details, instructions, loadSavedProspects]);

  async function handleDeleteProspect(id: string) {
    try {
      const res = await fetch(`/api/youtube-email/saved?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setSavedProspects((prev) => prev.filter((p) => p.id !== id));
        toast.success("Removed from saved files");
      }
    } catch {
      toast.error("Failed to delete");
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function copyAllEmails() {
    const allEmails = Array.from(new Set(savedProspects.flatMap((p) => p.emails))).filter(Boolean);
    if (!allEmails.length) {
      toast.info("No emails available to copy");
      return;
    }
    navigator.clipboard.writeText(allEmails.join("\n"));
    toast.success(`Copied ${allEmails.length} emails to clipboard`);
  }

  function exportCSV() {
    if (!savedProspects.length) {
      toast.info("No saved research to export");
      return;
    }
    const headers = ["Channel Name", "Channel URL", "Emails", "Websites", "Method", "Researched Date"];
    const rows = savedProspects.map((p) => [
      `"${p.channelName.replace(/"/g, '""')}"`,
      `"${p.channel.replace(/"/g, '""')}"`,
      `"${p.emails.join("; ").replace(/"/g, '""')}"`,
      `"${p.websites.join("; ").replace(/"/g, '""')}"`,
      `"${(p.method || "").replace(/"/g, '""')}"`,
      `"${p.researchedAt.slice(0, 10)}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `email_crawler_research_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported");
  }

  const filteredProspects = savedProspects.filter((p) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      p.channelName.toLowerCase().includes(q) ||
      p.channel.toLowerCase().includes(q) ||
      p.emails.some((e) => e.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="size-4" /> Prospect Finder
              </CardTitle>
              <CardDescription className="mt-1">
                Drop a link (YouTube channel, LinkedIn, company site — anything) and/or details about a
                prospect. Five specialized agents take turns — YouTube Extractor, Deep Crawler, Browse
                Agent, Pattern Verifier, OSINT Harvester — each handing off to the next until an email
                is found. No prerequisites. It starts immediately.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilesOpen(true)}
              className="shrink-0 gap-2"
            >
              <FolderArchive className="size-3.5" />
              Files
              <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[11px] font-mono text-primary">
                {savedProspects.length}
              </span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground/50">Prospect link (optional)</label>
            <Input
              placeholder="https://youtube.com/@channel, linkedin.com/in/..., or a company site"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground/50">Prospect details</label>
            <Textarea
              placeholder="Name, company, role, anything you know about the prospect"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground/50">Extra instructions (optional)</label>
            <Textarea
              placeholder="e.g. prefer personal email, check the team page first"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={run} disabled={running} className="self-start">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {running ? "Agents working the handoff…" : "Crawl for email"}
          </Button>
        </CardContent>
      </Card>

      <BulkCsvImport />

      {trail.length > 0 && <AgentPipeline trail={trail} />}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4" /> Found emails
            </CardTitle>
            <CardDescription>
              Verified with Reacher. {imported} new lead(s) imported into Leads.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {results.map((r) => (
              <div
                key={r.email}
                className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{r.email}</span>
                  <span className="text-xs text-foreground/40">{r.source}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.leadId ? (
                    <Badge variant="outline" className="!bg-indigo-500/10 !text-indigo-400 !border-indigo-500/20">
                      <UserPlus className="size-3" /> Lead
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className={VERDICT_STYLE[r.verdict as Verdict]}>
                    <ShieldCheck className="size-3" /> {r.verdict}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {raw && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent raw output</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-foreground/70">{raw}</pre>
          </CardContent>
        </Card>
      )}

      <Sheet open={filesOpen} onOpenChange={setFilesOpen}>
        <SheetContent side="right" className="flex flex-col sm:max-w-xl w-full p-0">
          <div className="border-b border-rule p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderArchive className="size-5 text-primary" />
                <SheetTitle className="font-label text-base font-semibold">Saved Research</SheetTitle>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {savedProspects.length} channels
              </Badge>
            </div>
            <SheetDescription className="mt-1 text-xs text-ink-muted">
              YouTube channels researched by the Email Crawler are logged here and mirrored to Knowledge.
              Every other source is imported directly into Leads.
            </SheetDescription>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter channels or emails…"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" onClick={copyAllEmails} className="h-8 gap-1.5 text-xs">
                <Copy className="size-3" />
                Copy Emails
              </Button>
              <Button size="sm" variant="outline" onClick={exportCSV} className="h-8 gap-1.5 text-xs">
                <Download className="size-3" />
                Export CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={loadSavedProspects} className="h-8 px-2" title="Refresh">
                <RefreshCw className={`size-3.5 ${filesLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {filteredProspects.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
                <FolderArchive className="size-10 mb-2 opacity-40" />
                <p className="text-sm font-medium">No saved research yet</p>
                <p className="text-xs mt-1">Crawl a YouTube channel above to see it saved here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProspects.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-rule bg-card/60 p-3.5 text-xs transition-colors hover:border-rule-strong"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-strong">{p.channelName}</span>
                          <span className="text-[10px] text-ink-faint">{p.researchedAt.slice(0, 10)}</span>
                        </div>
                        <a
                          href={p.channel}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                        >
                          {p.channel}
                          <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                      <button
                        onClick={() => handleDeleteProspect(p.id)}
                        className="rounded p-1 text-ink-faint hover:text-rose-500 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="mt-2.5 space-y-1 border-t border-rule/50 pt-2">
                      <span className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">Emails</span>
                      {p.emails.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.emails.map((email) => (
                            <div
                              key={email}
                              className="inline-flex items-center gap-1.5 rounded bg-emerald-500/10 px-2 py-1 font-mono text-emerald-500 ring-1 ring-emerald-500/20"
                            >
                              <Mail className="size-3" />
                              <span>{email}</span>
                              <button
                                onClick={() => handleCopy(email, `${p.id}-${email}`)}
                                className="ml-1 text-emerald-600 hover:text-emerald-400"
                                title="Copy"
                              >
                                {copiedId === `${p.id}-${email}` ? (
                                  <Check className="size-2.5" />
                                ) : (
                                  <Copy className="size-2.5" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-ink-faint italic">No emails found</p>
                      )}
                    </div>

                    {p.websites.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">
                          Links & Socials
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {p.websites.map((w) => (
                            <a
                              key={w}
                              href={w}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                            >
                              <Globe className="size-3" />
                              <span className="truncate max-w-[180px]">{w}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
