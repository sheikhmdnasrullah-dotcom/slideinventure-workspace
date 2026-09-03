"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Loader2,
  Mail,
  Plus,
  Send,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Target = { id: string; firstName: string; lastName: string; email: string };

type RecipientMessage = { subject: string; message: string };

type Option = { name: string };

type SendResult = {
  email: string;
  firstName: string;
  lastName: string;
  success: boolean;
  campaignId?: string;
  error?: string;
};

type SendResponse = {
  total: number;
  succeeded: number;
  failed: number;
  results: SendResult[];
};

const STEPS = ["Import", "Compose", "Sender", "Review", "Send"] as const;
type Step = (typeof STEPS)[number];

let idCounter = 0;
function newId() {
  idCounter += 1;
  return `t-${Date.now()}-${idCounter}`;
}

function parseCsv(text: string): Target[] {
  const rows = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  const header = parseLine(rows[0]).map((h) => h.toLowerCase());
  const firstIdx = header.findIndex((h) => h.includes("first"));
  const lastIdx = header.findIndex((h) => h.includes("last"));
  const emailIdx = header.findIndex((h) => h.includes("email"));

  if (emailIdx === -1) {
    throw new Error("CSV must include an 'Email' column");
  }

  const targets: Target[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = parseLine(rows[r]);
    const email = (cells[emailIdx] ?? "").trim();
    if (!email) continue;
    targets.push({
      id: newId(),
      firstName: firstIdx >= 0 ? (cells[firstIdx] ?? "").trim() : "",
      lastName: lastIdx >= 0 ? (cells[lastIdx] ?? "").trim() : "",
      email,
    });
  }
  return targets;
}

export function CustomMessagePanel() {
  const [step, setStep] = useState<Step>("Import");

  const [targets, setTargets] = useState<Target[]>([]);
  const [messages, setMessages] = useState<Record<string, RecipientMessage>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [sendingProfiles, setSendingProfiles] = useState<Option[]>([]);
  const [landingPages, setLandingPages] = useState<Option[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [selectedPage, setSelectedPage] = useState<string>("");

  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResponse | null>(null);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const res = await fetch("/api/gophish/options", { method: "GET" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load Gophish options");
      }
      const data = (await res.json()) as { sendingProfiles: Option[]; landingPages: Option[] };
      setSendingProfiles(data.sendingProfiles ?? []);
      setLandingPages(data.landingPages ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load Gophish options");
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const setMessage = (id: string, patch: Partial<RecipientMessage>) => {
    setMessages((prev) => ({
      ...prev,
      [id]: { subject: "", message: "", ...prev[id], ...patch },
    }));
  };

  const selectedTarget = useMemo(
    () => targets.find((t) => t.id === selectedId) ?? null,
    [targets, selectedId]
  );

  const allComposed = useMemo(
    () => targets.every((t) => (messages[t.id]?.subject ?? "").trim() && (messages[t.id]?.message ?? "").trim()),
    [targets, messages]
  );

  const stepIndex = STEPS.indexOf(step);
  const go = (next: Step) => setStep(next);

  // ---- Step A: Import ----
  const onCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ""));
        if (parsed.length === 0) {
          toast.error("No valid rows found in CSV");
          return;
        }
        setTargets(parsed);
        setSelectedId(parsed[0]?.id ?? null);
        toast.success(`Imported ${parsed.length} targets`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  };

  const addManual = (firstName: string, lastName: string, email: string) => {
    const id = newId();
    setTargets((prev) => [...prev, { id, firstName, lastName, email }]);
    setSelectedId(id);
  };

  const removeTarget = (id: string) => {
    setTargets((prev) => prev.filter((t) => t.id !== id));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedId === id) setSelectedId(null);
  };

  // ---- Step E: Send ----
  const send = async () => {
    if (!selectedProfile || !selectedPage) {
      toast.error("Select a sending profile and landing page");
      return;
    }
    setSending(true);
    setResults(null);
    try {
      const res = await fetch("/api/gophish/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: targets.map((t) => ({
            firstName: t.firstName,
            lastName: t.lastName,
            email: t.email,
            subject: messages[t.id]?.subject ?? "",
            message: messages[t.id]?.message ?? "",
          })),
          sendingProfileName: selectedProfile,
          landingPageName: selectedPage,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Send request failed");
      }
      const data = (await res.json()) as SendResponse;
      setResults(data);
      setStep("Send");
      if (data.failed > 0) {
        toast.error(`${data.failed} of ${data.total} failed`);
      } else {
        toast.success(`All ${data.total} sent`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => {
          const active = s === step;
          const done = i < stepIndex;
          return (
            <div key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i <= stepIndex && go(s)}
                disabled={i > stepIndex}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : done
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-foreground/10 text-muted-foreground"
                }`}
              >
                <span
                  className={`flex size-4 items-center justify-center rounded-full text-[10px] ${
                    active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-white" : "bg-foreground/10"
                  }`}
                >
                  {i + 1}
                </span>
                {s}
              </button>
              {i < STEPS.length - 1 && <Separator orientation="horizontal" className="w-4" />}
            </div>
          );
        })}
      </div>

      {step === "Import" && (
        <ImportStep
          targets={targets}
          onCsv={onCsv}
          onAddManual={addManual}
          onRemove={removeTarget}
          onNext={() => targets.length > 0 && go("Compose")}
        />
      )}

      {step === "Compose" && (
        <ComposeStep
          targets={targets}
          messages={messages}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={setMessage}
          onRemove={removeTarget}
          canNext={allComposed}
          onNext={() => go("Sender")}
          onBack={() => go("Import")}
        />
      )}

      {step === "Sender" && (
        <SenderStep
          optionsLoading={optionsLoading}
          profiles={sendingProfiles}
          pages={landingPages}
          selectedProfile={selectedProfile}
          selectedPage={selectedPage}
          onProfile={(v) => setSelectedProfile(v)}
          onPage={(v) => setSelectedPage(v)}
          onNext={() => selectedProfile && selectedPage && go("Review")}
          onBack={() => go("Compose")}
        />
      )}

      {step === "Review" && (
        <ReviewStep
          targets={targets}
          messages={messages}
          profile={selectedProfile}
          page={selectedPage}
          onBack={() => go("Sender")}
          onNext={() => go("Send")}
        />
      )}

      {step === "Send" && (
        <SendStep
          sending={sending}
          results={results}
          total={targets.length}
          onSend={send}
          onBack={() => go("Review")}
        />
      )}
    </div>
  );
}

/* ---------------- Step A ---------------- */
function ImportStep({
  targets,
  onCsv,
  onAddManual,
  onRemove,
  onNext,
}: {
  targets: Target[];
  onCsv: (file: File) => void;
  onAddManual: (firstName: string, lastName: string, email: string) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
}) {
  const [fn, setFn] = useState("");
  const [ln, setLn] = useState("");
  const [email, setEmail] = useState("");

  const add = () => {
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    onAddManual(fn.trim(), ln.trim(), email.trim());
    setFn("");
    setLn("");
    setEmail("");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4" /> Upload CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Columns: <code className="rounded bg-foreground/10 px-1">First Name</code>,{" "}
            <code className="rounded bg-foreground/10 px-1">Last Name</code>,{" "}
            <code className="rounded bg-foreground/10 px-1">Email</code>
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/20 p-8 text-sm text-muted-foreground hover:bg-foreground/5">
            <FileUp className="size-6" />
            Click to choose a CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsv(f);
              }}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" /> Add one at a time
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label>First Name</Label>
              <Input value={fn} onChange={(e) => setFn(e.target.value)} placeholder="Jane" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Last Name</Label>
              <Input value={ln} onChange={(e) => setLn(e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <Button type="button" variant="secondary" onClick={add}>
            <Plus className="size-4" /> Add target
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Imported targets ({targets.length})</CardTitle>
          <Button disabled={targets.length === 0} onClick={onNext}>
            Next: Compose <ArrowRight className="size-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No targets yet.</p>
          ) : (
            <ScrollArea className="max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>First</TableHead>
                    <TableHead>Last</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.firstName || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{t.lastName || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{t.email}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => onRemove(t.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Step B ---------------- */
function ComposeStep({
  targets,
  messages,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  canNext,
  onNext,
  onBack,
}: {
  targets: Target[];
  messages: Record<string, RecipientMessage>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<RecipientMessage>) => void;
  onRemove: (id: string) => void;
  canNext: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  const selected = targets.find((t) => t.id === selectedId) ?? null;
  const msg = selected ? messages[selected.id] ?? { subject: "", message: "" } : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Targets ({targets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px] pr-2">
            <div className="flex flex-col gap-1">
              {targets.map((t) => {
                const has = Boolean((messages[t.id]?.subject ?? "").trim() && (messages[t.id]?.message ?? "").trim());
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                      t.id === selectedId ? "border-primary bg-primary/10" : "border-foreground/10 hover:bg-foreground/5"
                    }`}
                  >
                    <span className="truncate">
                      {t.firstName || t.lastName ? `${t.firstName} ${t.lastName}`.trim() : t.email}
                      <span className="block truncate text-xs text-muted-foreground">{t.email}</span>
                    </span>
                    {has && <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {selected ? `Compose for ${selected.email}` : "Select a target"}
          </CardTitle>
          {selected && (
            <Button size="icon" variant="ghost" onClick={() => onRemove(selected.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!selected || !msg ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Pick a target from the left to write their message.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Label>Subject</Label>
                <Input
                  value={msg.subject}
                  onChange={(e) => onChange(selected.id, { subject: e.target.value })}
                  placeholder="Your subject line"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Message</Label>
                <Textarea
                  value={msg.message}
                  onChange={(e) => onChange(selected.id, { message: e.target.value })}
                  placeholder="Write the email body. {{.TrackingURL}} is added automatically for click tracking."
                  className="min-h-64"
                />
                <p className="text-xs text-muted-foreground">
                  The tracking link is appended automatically if you don&apos;t include it.
                </p>
              </div>
            </>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button disabled={!canNext} onClick={onNext}>
              Next: Sender <ArrowRight className="size-4" />
            </Button>
          </div>
          {!canNext && (
            <p className="text-right text-xs text-muted-foreground">
              Every target needs a subject and message before continuing.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Step C ---------------- */
function SenderStep({
  optionsLoading,
  profiles,
  pages,
  selectedProfile,
  selectedPage,
  onProfile,
  onPage,
  onNext,
  onBack,
}: {
  optionsLoading: boolean;
  profiles: Option[];
  pages: Option[];
  selectedProfile: string;
  selectedPage: string;
  onProfile: (v: string) => void;
  onPage: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Choose sender & landing page</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {optionsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading your Gophish profiles…
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <Label>Sending profile</Label>
              <Select value={selectedProfile} onValueChange={onProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sending profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {profiles.length} profile(s) available across your domains.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Landing page</Label>
              <Select value={selectedPage} onValueChange={onPage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a landing page" />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {pages.length} landing page(s) available.
              </p>
            </div>
          </>
        )}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button disabled={!selectedProfile || !selectedPage} onClick={onNext}>
            Next: Review <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Step D ---------------- */
function ReviewStep({
  targets,
  messages,
  profile,
  page,
  onBack,
  onNext,
}: {
  targets: Target[];
  messages: Record<string, RecipientMessage>;
  profile: string;
  page: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Review & confirm</CardTitle>
        <Badge variant="outline">{targets.length} email(s) about to send</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-foreground/10 p-3">
            <p className="text-xs uppercase text-muted-foreground">Sending profile</p>
            <p className="font-medium">{profile}</p>
          </div>
          <div className="rounded-md border border-foreground/10 p-3">
            <p className="text-xs uppercase text-muted-foreground">Landing page</p>
            <p className="font-medium">{page}</p>
          </div>
        </div>

        <ScrollArea className="h-[360px]">
          <div className="flex flex-col gap-2 pr-2">
            {targets.map((t) => {
              const m = messages[t.id] ?? { subject: "", message: "" };
              return (
                <div key={t.id} className="rounded-md border border-foreground/10 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="font-medium">{t.email}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">Subject: {m.subject}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {m.message}
                    {!m.message.includes("{{.TrackingURL}}") && (
                      <span className="ml-1 text-emerald-400">(+ tracking link)</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button onClick={onNext}>
            Continue to send <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Step E ---------------- */
function SendStep({
  sending,
  results,
  total,
  onSend,
  onBack,
}: {
  sending: boolean;
  results: SendResponse | null;
  total: number;
  onSend: () => void;
  onBack: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{results ? "Send results" : "Ready to send"}</CardTitle>
        {results && (
          <Badge variant={results.failed === 0 ? "default" : "destructive"}>
            {results.succeeded}/{results.total} succeeded
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!results && (
          <p className="text-sm text-muted-foreground">
            You are about to send <strong>{total}</strong> customized email(s) through Gophish. Each
            is sent individually with a short delay between them. This cannot be undone.
          </p>
        )}

        {results && (
          <ScrollArea className="h-[360px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.results.map((r, i) => (
                  <TableRow key={`${r.email}-${i}`}>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>
                      {r.success ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="size-4" /> Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <XCircle className="size-4" /> Failed
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.success ? `Campaign ${r.campaignId}` : r.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack} disabled={sending}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          {!results ? (
            <Button onClick={onSend} disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? "Sending…" : `Send ${total} email(s)`}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onSend} disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? "Resending…" : "Send again"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
