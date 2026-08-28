"use client";

import * as React from "react";
import Link from "next/link";
import {
  FolderArchive,
  Download,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  BookOpen,
  RefreshCw,
  Search,
  Video,
  ArrowLeft,
  Sparkles,
  Mail,
  Globe,
  Loader2,
} from "lucide-react";
import { SiteHeader } from "@/components/dashboard/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type Result = {
  channel: string;
  email: string | null;
  emails?: string[];
  websites?: string[];
  method: string | null;
  error?: string | null;
};

type SavedProspect = {
  id: string;
  channel: string;
  channelName: string;
  emails: string[];
  websites: string[];
  method: string | null;
  researchedAt: string;
  notes?: string;
};

export default function YouTubeEmailAgentPage() {
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<Result[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Files drawer state
  const [filesOpen, setFilesOpen] = React.useState(false);
  const [savedProspects, setSavedProspects] = React.useState<SavedProspect[]>([]);
  const [filesLoading, setFilesLoading] = React.useState(false);
  const [searchFilter, setSearchFilter] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Load saved prospects from API
  const loadSavedProspects = React.useCallback(async () => {
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

  React.useEffect(() => {
    loadSavedProspects();
  }, [loadSavedProspects]);

  // Main extraction runner - preserves the exact same framework
  async function run() {
    const channels = input
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    if (!channels.length || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "request failed");
      } else {
        const returnedResults = data.results || [];
        setResults(returnedResults);
        
        // Instant save notification & sync
        const extractedCount = returnedResults.filter(
          (r: Result) => (r.emails && r.emails.length > 0) || r.email
        ).length;
        if (extractedCount > 0) {
          toast.success(
            `Extracted & saved ${extractedCount} prospect${extractedCount > 1 ? "s" : ""} to Knowledge!`
          );
        }
        // Refresh saved files
        loadSavedProspects();
      }
    } catch (e: any) {
      setError(e?.message ?? "request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProspect(id: string) {
    try {
      const res = await fetch(`/api/youtube-email/saved?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSavedProspects((prev) => prev.filter((p) => p.id !== id));
        toast.success("Prospect removed from saved files");
      }
    } catch {
      toast.error("Failed to delete prospect");
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function copyAllEmails() {
    const allEmails = Array.from(
      new Set(savedProspects.flatMap((p) => p.emails))
    ).filter(Boolean);
    if (!allEmails.length) {
      toast.info("No emails available to copy");
      return;
    }
    navigator.clipboard.writeText(allEmails.join("\n"));
    toast.success(`Copied ${allEmails.length} emails to clipboard`);
  }

  function exportCSV() {
    if (!savedProspects.length) {
      toast.info("No saved prospects to export");
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
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `youtube_prospects_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  }

  const filteredProspects = savedProspects.filter((p) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      p.channelName.toLowerCase().includes(q) ||
      p.channel.toLowerCase().includes(q) ||
      p.emails.some((e) => e.toLowerCase().includes(q)) ||
      p.websites.some((w) => w.toLowerCase().includes(q))
    );
  });

  const totalDiscoveredEmails = savedProspects.reduce((acc, p) => acc + p.emails.length, 0);

  return (
    <>
      <SiteHeader
        crumbs={[{ label: "Agents", href: "/agents" }, { label: "YouTube Email Agent" }]}
        subtitle="Dedicated Lead Generation Agent"
      />

      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Top Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/agents"
              className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-[var(--surface)] px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink-strong"
            >
              <ArrowLeft className="size-3.5" />
              All Agents
            </Link>
            <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
              <Video className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-label text-base font-semibold text-ink-strong">
                  YouTube Email Extractor Agent
                </h1>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  Lead Gen
                </Badge>
              </div>
              <p className="text-xs text-ink-muted">
                Extracts business inquiry emails and links with headless browser & CAPTCHA solving.
              </p>
            </div>
          </div>

          {/* Files Button & Knowledge Deep Link */}
          <div className="flex items-center gap-2">
            <Link
              href="/knowledge?q=YouTube"
              className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-primary hover:text-primary transition-colors"
            >
              <BookOpen className="size-3.5 text-primary" />
              <span>View in Knowledge</span>
            </Link>

            <Button
              variant="default"
              size="sm"
              onClick={() => setFilesOpen(true)}
              className="gap-2 shadow-sm font-medium"
            >
              <FolderArchive className="size-4" />
              <span>Files</span>
              <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[11px] font-mono">
                {savedProspects.length}
              </span>
            </Button>
          </div>
        </div>

        {/* Extractor Input Card */}
        <div className="rounded-xl border border-rule bg-card/60 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="block font-label text-xs font-medium text-ink-strong">
              Channel URLs (one per line)
            </label>
            <span className="text-[11px] text-ink-muted">
              Auto-syncs researched prospects directly to Knowledge
            </span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              "https://www.youtube.com/@MrBeast/about\nhttps://www.youtube.com/@Vercel/about\nhttps://www.youtube.com/@Fireship"
            }
            rows={5}
            className="mt-2 w-full rounded-md border border-rule bg-background px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={run}
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Extracting & Solving CAPTCHA…</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>Extract emails</span>
                </>
              )}
            </button>
            <span className="text-xs text-ink-muted">
              {input.split("\n").filter((c) => c.trim()).length} target(s) queued
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
            {error}
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-label text-sm font-medium text-ink-strong">
                Current Research Results ({results.length})
              </h2>
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <Check className="size-3.5" /> Automatically saved to Files & Knowledge
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-rule bg-card/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule bg-card/60">
                    <th className="px-4 py-2.5 text-left font-label text-xs text-ink-muted">Channel</th>
                    <th className="px-4 py-2.5 text-left font-label text-xs text-ink-muted">Discovered Emails</th>
                    <th className="px-4 py-2.5 text-left font-label text-xs text-ink-muted">Websites & Links</th>
                    <th className="px-4 py-2.5 text-left font-label text-xs text-ink-muted">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {results.map((r, i) => {
                    const emails = r.emails && r.emails.length ? r.emails : r.email ? [r.email] : [];
                    return (
                      <tr key={i} className="hover:bg-card/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-ink-strong break-all max-w-[240px]">
                          <a
                            href={r.channel}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center gap-1 text-primary"
                          >
                            {r.channel}
                            <ExternalLink className="size-3 opacity-60" />
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          {emails.length ? (
                            <div className="space-y-1.5">
                              {emails.map((e) => (
                                <div key={e} className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-emerald-500 break-all">
                                    {e}
                                  </span>
                                  <button
                                    onClick={() => handleCopy(e, `res-${i}-${e}`)}
                                    title="Copy email"
                                    className="text-ink-muted hover:text-ink-strong"
                                  >
                                    {copiedId === `res-${i}-${e}` ? (
                                      <Check className="size-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="size-3" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-ink-faint italic">No email revealed</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.websites && r.websites.length ? (
                            <div className="space-y-1">
                              {r.websites.map((w) => (
                                <div key={w} className="text-xs text-sky-400 break-all">
                                  <a href={w} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                    {w}
                                    <ExternalLink className="size-2.5 opacity-60" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-ink-faint">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-muted">
                          {r.method ?? "browser-captcha"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Files Slide-over Sheet (Saved Researched Prospects) */}
      <Sheet open={filesOpen} onOpenChange={setFilesOpen}>
        <SheetContent side="right" className="flex flex-col sm:max-w-xl w-full p-0">
          <div className="border-b border-rule p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderArchive className="size-5 text-primary" />
                <SheetTitle className="font-label text-base font-semibold">
                  Researched Prospects & Leads
                </SheetTitle>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {savedProspects.length} channels · {totalDiscoveredEmails} emails
              </Badge>
            </div>
            <SheetDescription className="mt-1 text-xs text-ink-muted">
              Every prospect and email extracted by this agent is automatically logged here and mirrored to Knowledge.
            </SheetDescription>

            {/* Quick Actions & Search */}
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

          {/* Prospects List in Drawer */}
          <ScrollArea className="flex-1 p-4">
            {filteredProspects.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
                <FolderArchive className="size-10 mb-2 opacity-40" />
                <p className="text-sm font-medium">No researched prospects found</p>
                <p className="text-xs mt-1">
                  Extract channel emails above to automatically save them into your vault.
                </p>
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
                        title="Remove from saved files"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    {/* Discovered Emails */}
                    <div className="mt-2.5 space-y-1 border-t border-rule/50 pt-2">
                      <span className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">
                        Emails
                      </span>
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

                    {/* Websites / Socials */}
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
    </>
  );
}
