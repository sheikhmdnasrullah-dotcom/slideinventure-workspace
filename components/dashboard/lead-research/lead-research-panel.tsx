"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Globe,
  Loader2,
  Play,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Users,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RowStatus = "pending" | "researching" | "done" | "error";

type Row = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  position: string;
  personalizedInfo: string;
  researchSnippets: string[];
  status: RowStatus;
  error?: string;
};

type Session = {
  id: string;
  owner: string;
  status: "pending" | "running" | "done" | "error";
  fileName: string;
  rows: Row[];
  discoveredColumns: string[];
  agentSlugs: string[];
  progress: number;
  doneCount: number;
  totalCount: number;
  createdAt: string;
  updatedAt: string;
  csv?: string;
};

export function LeadResearchPanel() {
  const router = useRouter();
  const [fileName, setFileName] = useState("leads.csv");
  const [csvText, setCsvText] = useState("");
  const [pasteMode, setPasteMode] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [agents, setAgents] = useState<{ slug: string; name: string; emoji?: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftInfo, setDraftInfo] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/agents/roster", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((data) => setAgents(data.agents ?? []))
      .catch(() => {});
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/lead-research/jobs/${id}`, { cache: "no-store" });
          if (!res.ok) {
            stopPolling();
            setRunning(false);
            return;
          }
          const data = (await res.json()) as { session: Session };
          setSession(data.session);
          if (data.session.status === "done" || data.session.status === "error") {
            stopPolling();
            setRunning(false);
            if (data.session.status === "done") {
              toast.success("Research complete — personalized info ready");
            } else {
              toast.error("Research run ended with errors");
            }
          }
        } catch {
          // keep polling
        }
      }, 2500);
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const onFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      setFileName(file.name);
      setPasteMode(false);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!csvText.trim()) {
      toast.error("Paste or upload a CSV first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/lead-research/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, fileName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "Upload failed");
      setSession({ ...(data as Session), csv: data.previewCsv ?? "" });
      toast.success(`Created session with ${data.total ?? data.rows?.length ?? 0} leads`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (!session) return;
    setRunning(true);
    try {
      const res = await fetch(`/api/lead-research/run/${session.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "Run failed");
      setSession((prev) => (prev ? { ...prev, status: "running" } : prev));
      poll(session.id);
    } catch (e) {
      setRunning(false);
      toast.error(e instanceof Error ? e.message : "Run failed");
    }
  };

  const patchRows = async (patches: { id: string; [k: string]: string }[]) => {
    if (!session) return;
    const res = await fetch(`/api/lead-research/update/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patches }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error ?? "Update failed");
    setSession((prev) => (prev ? { ...prev, rows: data.rows } : prev));
  };

  const beginEdit = (row: Row) => {
    setEditingId(row.id);
    setDraftInfo(row.personalizedInfo);
  };

  const saveEdit = async (row: Row) => {
    try {
      await patchRows([{ id: row.id, personalizedInfo: draftInfo }]);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
    setEditingId(null);
  };

  const removeRow = async (row: Row) => {
    if (!session) return;
    const remaining = session.rows.filter((r) => r.id !== row.id);
    try {
      const res = await fetch(`/api/lead-research/update/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patches: remaining
            .map((r) => ({
              id: r.id,
              email: r.email,
              firstName: r.firstName,
              lastName: r.lastName,
              company: r.company,
              position: r.position,
              personalizedInfo: r.personalizedInfo,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "Update failed");
      setSession((prev) => (prev ? { ...prev, rows: data.rows } : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const downloadCsv = () => {
    if (!session) return;
    const blob = new Blob([session.csv ?? ""], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (fileName.replace(/\.csv$/i, "") || "leads") + "-researched.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCsv = async () => {
    if (!session?.csv) return;
    try {
      await navigator.clipboard.writeText(session.csv);
      toast.success("Revised CSV copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const doneCount = session?.rows.filter((r) => r.status === "done").length ?? 0;
  const progress = session ? (session.totalCount ? doneCount / session.totalCount : 0) : 0;

  return (
    <div className="flex flex-col gap-5">
      {!session ? (
        <Card className="border-foreground/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="size-4" />
              Upload your lead list
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              CSV with an <span className="font-mono">Email</span> column. First Name, Last Name,
              Company, Position are picked up automatically if present. An existing{" "}
              <span className="font-mono">Personalized Information</span> column is preserved.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-foreground/10 bg-secondary px-2 py-1 text-xs hover:bg-secondary/70">
                <Upload className="size-3" />
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    onFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button size="sm" variant="outline" onClick={() => setPasteMode((v) => !v)} className="text-xs">
                {pasteMode ? "Use a file" : "Paste text"}
              </Button>
              {fileName !== "leads.csv" && (
                <Badge variant="outline" className="text-[10px]">
                  {fileName}
                </Badge>
              )}
            </div>

            {pasteMode ? (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">CSV text</Label>
                <Textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={"Email,First Name,Last Name,Company,Position\njohn@acme.com,John,Doe,Acme,CEO"}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-foreground/20 p-6 text-center text-xs text-muted-foreground">
                {csvText ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="size-6 text-emerald-600" />
                    <span>{fileName} loaded ({csvText.split(/\r?\n/).filter(Boolean).length - 1} rows)</span>
                    <Button size="sm" variant="outline" onClick={() => setPasteMode(true)} className="text-xs">
                      View / edit as text
                    </Button>
                  </div>
                ) : (
                  <span>Choose a .csv file above to load it.</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleUpload} disabled={loading || !csvText.trim()} className="text-xs">
                {loading ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Upload className="mr-1 size-3" />}
                Import into Lead Research
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Header / status */}
          <Card className="border-foreground/10">
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <div className="flex min-w-[180px] flex-col gap-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileSpreadsheet className="size-4" />
                  {session.fileName}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {session.rows.length} leads · {doneCount} researched
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{Math.round(progress * 100)}%</span>
                  <span>
                    {session.status === "done"
                      ? "complete"
                      : session.status === "running"
                        ? "agents researching…"
                        : "ready to research"}
                  </span>
                </div>
                <Progress value={progress * 100} className="h-2" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {session.status === "done" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={copyCsv} className="text-xs">
                      <CheckCircle2 className="mr-1 size-3" />
                      Copy revised CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={downloadCsv} className="text-xs">
                      <Download className="mr-1 size-3" />
                      Download CSV
                    </Button>
                    <Button size="sm" onClick={() => router.push("/custom-email")} className="text-xs">
                      <ExternalLink className="mr-1 size-3" />
                      Send via Custom Email
                    </Button>
                  </>
                ) : session.status === "running" ? (
                  <Badge className="border border-sky-300 bg-sky-100 text-sky-800">
                    <Loader2 className="mr-1 size-3 animate-spin" />
                    {doneCount}/{session.rows.length} researched
                  </Badge>
                ) : (
                  <Button size="sm" onClick={handleRun} disabled={running} className="text-xs">
                    <Play className="mr-1 size-3" />
                    Research all leads
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agents involved */}
          <Card className="border-foreground/10">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4" />
                Research team ({session.agentSlugs.length} agents)
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Every lead is researched by a rotating member of your installed agent team, working
                through the list one by one in the backend. Personalized lines are guaranteed unique
                across the list and grounded in real search results.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {agents
                  .filter((a) => session.agentSlugs.includes(a.slug))
                  .slice(0, 14)
                  .map((a) => (
                    <span
                      key={a.slug}
                      className="flex items-center gap-1 rounded-full border border-foreground/10 bg-secondary/40 px-2 py-0.5 text-[10px]"
                    >
                      <Bot className="size-3" />
                      {a.emoji ? `${a.emoji} ` : ""}
                      {a.name}
                    </span>
                  ))}
                {agents.filter((a) => session.agentSlugs.includes(a.slug)).length === 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    Using research personas (MiroThinker, Open Deep Research, DeepResearchAgent).
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Editing table */}
          <Card className="border-foreground/10">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {editingId ? <Sparkles className="size-4" /> : <Search className="size-4" />}
                {editingId ? "Editing Personalized Information" : "Lead list"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px] rounded-lg border border-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Email</TableHead>
                      <TableHead className="text-[10px]">Name</TableHead>
                      <TableHead className="text-[10px]">Company</TableHead>
                      <TableHead className="text-[10px]">Position</TableHead>
                      <TableHead className="text-[10px] min-w-[280px]">Personalized Information</TableHead>
                      <TableHead className="w-20 text-[10px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {session.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="py-1 align-top">
                          <Input
                            value={row.email}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSession((prev) =>
                                prev
                                  ? { ...prev, rows: prev.rows.map((r) => (r.id === row.id ? { ...r, email: v } : r)) }
                                  : prev
                              );
                            }}
                            onBlur={() => patchRows([{ id: row.id, email: row.email }]).catch(() => {})}
                            className="h-7 text-[11px]"
                          />
                        </TableCell>
                        <TableCell className="py-1 align-top">
                          <div className="flex flex-col gap-1">
                            <Input
                              value={row.firstName}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSession((prev) =>
                                  prev
                                    ? { ...prev, rows: prev.rows.map((r) => (r.id === row.id ? { ...r, firstName: v } : r)) }
                                    : prev
                                );
                              }}
                              onBlur={() => patchRows([{ id: row.id, firstName: row.firstName }]).catch(() => {})}
                              className="h-7 text-[11px]"
                              placeholder="First"
                            />
                            <Input
                              value={row.lastName}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSession((prev) =>
                                  prev
                                    ? { ...prev, rows: prev.rows.map((r) => (r.id === row.id ? { ...r, lastName: v } : r)) }
                                    : prev
                                );
                              }}
                              onBlur={() => patchRows([{ id: row.id, lastName: row.lastName }]).catch(() => {})}
                              className="h-7 text-[11px]"
                              placeholder="Last"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="py-1 align-top">
                          <Input
                            value={row.company}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSession((prev) =>
                                prev
                                  ? { ...prev, rows: prev.rows.map((r) => (r.id === row.id ? { ...r, company: v } : r)) }
                                  : prev
                              );
                            }}
                            onBlur={() => patchRows([{ id: row.id, company: row.company }]).catch(() => {})}
                            className="h-7 text-[11px]"
                          />
                        </TableCell>
                        <TableCell className="py-1 align-top">
                          <Input
                            value={row.position}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSession((prev) =>
                                prev
                                  ? { ...prev, rows: prev.rows.map((r) => (r.id === row.id ? { ...r, position: v } : r)) }
                                  : prev
                              );
                            }}
                            onBlur={() => patchRows([{ id: row.id, position: row.position }]).catch(() => {})}
                            className="h-7 text-[11px]"
                          />
                        </TableCell>
                        <TableCell className="py-1 align-top">
                          {editingId === row.id ? (
                            <div className="flex flex-col gap-1">
                              <Textarea
                                value={draftInfo}
                                onChange={(e) => setDraftInfo(e.target.value)}
                                rows={4}
                                className="font-mono text-[11px]"
                              />
                              <div className="flex items-center gap-1">
                                <Button size="sm" onClick={() => saveEdit(row)} className="text-[10px]">
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="text-[10px]">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEdit(row)}
                              className="block w-full text-left"
                              title="Click to edit"
                            >
                              {row.personalizedInfo ? (
                                <span className="block whitespace-pre-wrap font-mono text-[11px] text-emerald-800">
                                  {row.personalizedInfo}
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  {row.status === "done" ? "—" : "Pending research"}
                                </span>
                              )}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="py-1 align-top">
                          <div className="flex flex-col items-start gap-1">
                            {row.status === "done" ? (
                              <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="mr-1 size-3" />
                                Done
                              </Badge>
                            ) : row.status === "researching" ? (
                              <Badge className="border border-sky-300 bg-sky-100 text-sky-800">
                                <Loader2 className="mr-1 size-3 animate-spin" />
                                Researching
                              </Badge>
                            ) : row.status === "error" ? (
                              <Badge className="border border-rose-300 bg-rose-100 text-rose-800" title={row.error}>
                                <XCircle className="mr-1 size-3" />
                                Error
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Pending
                              </Badge>
                            )}
                            <div className="flex items-center gap-1">
                              {row.researchSnippets.length > 0 && (
                                <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                  <Globe className="size-3" />
                                  {row.researchSnippets.length} sources
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => removeRow(row)}
                                className="text-rose-600 hover:text-rose-700"
                                title="Remove row"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Click the Personalized Information cell to edit it. Edits are saved to the revised CSV.</span>
                <span>{doneCount}/{session.rows.length} researched</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
