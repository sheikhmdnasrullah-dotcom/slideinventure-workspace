"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  FlaskConical,
  Loader2,
  Mail,
  Megaphone,
  Plus,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { parseLeadCsv, buildEmptyLead, type Lead } from "@/lib/cold-outreach/csv";
import {
  sanitizeOutreachEmail,
  sanitizeSubjectLine,
  type SpamViolation,
} from "@/lib/cold-outreach/antiSpamSanitizer";
import {
  previewSpintax,
  renderPersonalized,
} from "@/lib/cold-outreach/spintax";
import {
  scoreDeliverability,
  type DeliverabilityReport,
} from "@/lib/cold-outreach/deliverability";
import { getAgentRoster, type RosterAgent } from "@/lib/agents/roster";

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

type PersonalizedRow = {
  email: string;
  variables: Record<string, string>;
  body: string;
  subject: string;
};

const STEPS = ["Import", "Compose", "Sender", "Review", "Send"] as const;
type Step = (typeof STEPS)[number];

const VARIABLE_KEYS = ["FirstName", "LastName", "Email", "Position", "Company", "PersonalizedInfo"] as const;

function SafetyBadge({ score, violations }: { score: number; violations: SpamViolation[] }) {
  if (score >= 90 && violations.length === 0) {
    return (
      <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="mr-1 size-3" />
        100% Safe
      </Badge>
    );
  }
  if (violations.length > 0) {
    return (
      <Badge className="border border-amber-300 bg-amber-100 text-amber-800">
        <Wand2 className="mr-1 size-3" />
        {violations.length} Auto-Replaced
      </Badge>
    );
  }
  return (
    <Badge className="border border-yellow-300 bg-yellow-100 text-yellow-800">
      <AlertTriangle className="mr-1 size-3" />
      Risk Factors
    </Badge>
    );
}

function AuthHealthBadge() {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
        <Shield className="size-4" />
        Authentication Health: OK
      </div>
      <div className="text-[11px] text-emerald-900">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono">tanim.social</span>
          <span>·</span>
          <span>SPF</span>
          <span>·</span>
          <span>DKIM</span>
          <span>·</span>
          <span>DMARC</span>
          <span>·</span>
          <span>MTA-STS</span>
          <span>·</span>
          <span>TLS-RPT</span>
          <span>✓</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono">tanim.tech</span>
          <span>·</span>
          <span>SPF</span>
          <span>·</span>
          <span>DKIM</span>
          <span>·</span>
          <span>DMARC</span>
          <span>·</span>
          <span>MTA-STS</span>
          <span>·</span>
          <span>TLS-RPT</span>
          <span>✓</span>
        </div>
      </div>
    </div>
  );
}

function DeliverabilityMini({ report }: { report: DeliverabilityReport }) {
  const color =
    report.score >= 80
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : report.score >= 50
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-rose-300 bg-rose-50 text-rose-800";
  return (
    <div className={`rounded-lg border p-2.5 text-xs ${color}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">Deliverability {report.score}/100</span>
        <span className="text-[10px]">
          {report.spamWordCount} spam · {report.linkCount} links
        </span>
      </div>
      {report.issues.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[10px]">
          {report.issues.slice(0, 3).map((iss, i) => (
            <li key={i} className="flex items-start gap-1">
              <AlertTriangle className="mt-0.5 size-2.5 shrink-0" />
              <span>{iss.message}</span>
            </li>
          ))}
          {report.issues.length > 3 && (
            <li className="text-[10px]">+{report.issues.length - 3} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function CustomEmailPanel() {
  const [step, setStep] = useState<Step>("Import");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState<Record<string, RecipientMessage>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [masterTemplate, setMasterTemplate] = useState("");
  const [masterSubject, setMasterSubject] = useState("");
  const [autoSanitize, setAutoSanitize] = useState(true);
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [agentSlug, setAgentSlug] = useState("cold-outreach");
  const [sendingProfiles, setSendingProfiles] = useState<Option[]>([]);
  const [landingPages, setLandingPages] = useState<Option[]>([]);
  const [roster, setRoster] = useState<RosterAgent[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [selectedPage, setSelectedPage] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResponse | null>(null);
  const [personalizingId, setPersonalizingId] = useState<string | null>(null);
  const [personalizingAll, setPersonalizingAll] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [previewFor, setPreviewFor] = useState<{ leadId: string; variations: string[] } | null>(null);

  const setMessage = useCallback((id: string, patch: Partial<RecipientMessage>) => {
    setMessages((prev) => {
      const current = prev[id] ?? { subject: "", message: "" };
      return {
        ...prev,
        [id]: { ...current, ...patch },
      };
    });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/gophish/options", { method: "GET" });
        if (res.ok) {
          const data = (await res.json()) as { sendingProfiles: Option[]; landingPages: Option[] };
          if (!active) return;
          setSendingProfiles(data.sendingProfiles ?? []);
          setLandingPages(data.landingPages ?? []);
        }
      } catch {
      } finally {
        if (active) setOptionsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/agents/roster", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((data) => {
        if (active) setRoster(data.agents ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const onCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseLeadCsv(String(reader.result ?? ""));
        if (parsed.length === 0) {
          toast.error("No valid rows found in CSV");
          return;
        }
        setLeads(parsed);
        setSelectedId(parsed[0]?.id ?? null);
        toast.success(`Imported ${parsed.length} leads`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  };

  const addManual = () => {
    const lead = buildEmptyLead();
    setLeads((prev) => [...prev, lead]);
    setSelectedId(lead.id);
  };

  const updateLead = (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLead = (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedId === id) setSelectedId(null);
  };

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId]
  );

  const allComposed = useMemo(
    () =>
      leads.length > 0 &&
      leads.every(
        (l) =>
          (messages[l.id]?.subject ?? "").trim() &&
          (messages[l.id]?.message ?? "").trim()
      ),
    [leads, messages]
  );

  const readyCount = useMemo(
    () =>
      leads.filter(
        (l) =>
          (messages[l.id]?.subject ?? "").trim() &&
          (messages[l.id]?.message ?? "").trim()
      ).length,
    [leads, messages]
  );

  const stepIndex = STEPS.indexOf(step);
  const go = (next: Step) => setStep(next);

  const insertResolvedVariable = (lead: Lead, key: string) => {
    const value =
      key === "FirstName"
        ? lead.firstName
        : key === "LastName"
          ? lead.lastName
          : key === "Email"
            ? lead.email
            : key === "Position"
              ? lead.position
              : key === "Company"
                ? lead.company
                : key === "PersonalizedInfo"
                  ? lead.personalizedInfo
                  : "";
    if (!value) {
      toast.error(`${key} is empty for this lead`);
      return;
    }
    if (!selectedId) return;
    const current = messages[selectedId]?.message ?? "";
    setMessage(selectedId, { message: `${current}${current.endsWith(" ") || current.length === 0 ? "" : " "}${value}` });
  };

  const insertMergeTag = (key: string) => {
    if (!selectedId) return;
    const current = messages[selectedId]?.message ?? "";
    setMessage(selectedId, { message: `${current}${current.endsWith(" ") || current.length === 0 ? "" : " "}{{.${key}}}` });
  };

  const personalizeOne = async (lead: Lead) => {
    if (!masterTemplate) {
      toast.error("Write a master template first (it guides the agent)");
      return;
    }
    setPersonalizingId(lead.id);
    try {
      const res = await fetch("/api/cold-outreach/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: masterTemplate,
          subject: masterSubject,
          placeholders: [...VARIABLE_KEYS],
          leads: [lead],
          agentSlug,
          useWebSearch,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "Personalization failed");
      const row: PersonalizedRow | undefined = (data.rows ?? [])[0];
      if (!row) throw new Error("No personalized result");
      setMessage(lead.id, {
        subject: row.subject || masterSubject || "",
        message: row.body,
      });
      toast.success(`Personalized via ${agentSlug}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Personalization failed");
    } finally {
      setPersonalizingId(null);
    }
  };

  const personalizeAll = async () => {
    if (leads.length === 0) {
      toast.error("Import leads first");
      return;
    }
    if (!masterTemplate) {
      toast.error("Write a master template first");
      return;
    }
    setPersonalizingAll(true);
    try {
      const res = await fetch("/api/cold-outreach/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: masterTemplate,
          subject: masterSubject,
          placeholders: [...VARIABLE_KEYS],
          leads: leads.map((l) => ({
            email: l.email,
            firstName: l.firstName,
            lastName: l.lastName,
            company: l.company,
            position: l.position,
            personalizedInfo: l.personalizedInfo,
          })),
          agentSlug,
          useWebSearch,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "Personalization failed");
      const rows: PersonalizedRow[] = data.rows ?? [];
      const byEmail = new Map(rows.map((r) => [r.email.toLowerCase(), r]));
      let count = 0;
      for (const lead of leads) {
        const row = byEmail.get(lead.email.toLowerCase());
        if (!row) continue;
        setMessage(lead.id, {
          subject: row.subject || masterSubject || "",
          message: row.body,
        });
        count++;
      }
      toast.success(`Personalized ${count}/${leads.length} leads via ${agentSlug}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Personalization failed");
    } finally {
      setPersonalizingAll(false);
    }
  };

  const sanitizeOne = (lead: Lead) => {
    const m = messages[lead.id] ?? { subject: "", message: "" };
    const subjRes = sanitizeSubjectLine(m.subject);
    const bodyRes = sanitizeOutreachEmail(m.message);
    setMessage(lead.id, { subject: subjRes.sanitizedText, message: bodyRes.sanitizedText });
    toast.success(
      `Sanitized ${subjRes.violationsFound.length + bodyRes.violationsFound.length} triggers`
    );
  };

  const showPreview = (lead: Lead) => {
    const m = messages[lead.id]?.message ?? "";
    if (!m) {
      toast.error("Write a body first");
      return;
    }
    setPreviewFor({ leadId: lead.id, variations: previewSpintax(m, 5) });
  };

  const renderLeadDraft = (lead: Lead) => messages[lead.id];

  const selectedSubject = selectedLead
    ? autoSanitize
      ? sanitizeSubjectLine(renderLeadDraft(selectedLead)?.subject ?? "").sanitizedText
      : renderLeadDraft(selectedLead)?.subject ?? ""
    : "";
  const selectedBody = selectedLead
    ? autoSanitize
      ? sanitizeOutreachEmail(renderLeadDraft(selectedLead)?.message ?? "").sanitizedText
      : renderLeadDraft(selectedLead)?.message ?? ""
    : "";
  const selectedSubjectSan = selectedLead
    ? sanitizeSubjectLine(renderLeadDraft(selectedLead)?.subject ?? "")
    : { violationsFound: [], safetyScore: 100 };
  const selectedBodySan = selectedLead
    ? sanitizeOutreachEmail(renderLeadDraft(selectedLead)?.message ?? "")
    : { violationsFound: [], safetyScore: 100 };
  const selectedViolations: SpamViolation[] = [
    ...selectedSubjectSan.violationsFound,
    ...selectedBodySan.violationsFound,
  ];
  const selectedReport = useMemo(
    () =>
      selectedLead
        ? scoreDeliverability({
            subject: selectedSubject,
            body: selectedBody,
            fallbackVars: {
              FirstName: selectedLead.firstName,
              LastName: selectedLead.lastName,
              Email: selectedLead.email,
              Position: selectedLead.position,
              Company: selectedLead.company,
            },
          })
        : null,
    [selectedLead, selectedSubject, selectedBody]
  );

  const send = async () => {
    if (!selectedProfile || !selectedPage) {
      toast.error("Select a sending profile and landing page");
      return;
    }
    if (!allComposed) {
      toast.error("All recipients need a subject and message");
      return;
    }
    if (!confirmSend) {
      toast.error("Please confirm the send in the Review step");
      return;
    }
    setSending(true);
    setResults(null);
    try {
      const res = await fetch("/api/gophish/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: leads.map((l) => {
            const subjRes = sanitizeSubjectLine(messages[l.id]?.subject ?? "");
            const bodyRes = sanitizeOutreachEmail(messages[l.id]?.message ?? "");
            return {
              firstName: l.firstName,
              lastName: l.lastName,
              email: l.email,
              subject: autoSanitize ? subjRes.sanitizedText : messages[l.id]?.subject ?? "",
              message: autoSanitize ? bodyRes.sanitizedText : messages[l.id]?.message ?? "",
            };
          }),
          sendingProfileName: selectedProfile,
          landingPageName: selectedPage,
          campaignName: campaignName || undefined,
          groupName: groupName || undefined,
          launchDate: scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
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
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                      : "border-foreground/10 text-muted-foreground"
                }`}
              >
                <span
                  className={`flex size-4 items-center justify-center rounded-full text-[10px] ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-emerald-500 text-white"
                        : "bg-foreground/10"
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
        <div className="flex flex-col gap-4">
          <Card className="border-foreground/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Import recipients</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  CSV columns: Email, First Name, Last Name, Company, Position. Duplicates and invalid
                  emails are removed automatically.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-foreground/10 bg-secondary px-2 py-1 text-xs hover:bg-secondary/70">
                  <Upload className="size-3" />
                  Import CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) onCsv(f);
                    }}
                  />
                </label>
                <Button size="sm" variant="outline" onClick={addManual} className="text-xs">
                  <Plus className="mr-1 size-3" />
                  Add manually
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[420px] rounded-lg border border-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Email</TableHead>
                      <TableHead className="text-[10px]">First</TableHead>
                      <TableHead className="text-[10px]">Last</TableHead>
                      <TableHead className="text-[10px]">Company</TableHead>
                      <TableHead className="text-[10px]">Position</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                          No recipients. Import a CSV or add manually.
                        </TableCell>
                      </TableRow>
                    ) : (
                      leads.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="py-1">
                            <Input
                              value={l.email}
                              onChange={(e) => updateLead(l.id, { email: e.target.value })}
                              className="h-7 text-[11px]"
                              placeholder="email@example.com"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input
                              value={l.firstName}
                              onChange={(e) => updateLead(l.id, { firstName: e.target.value })}
                              className="h-7 text-[11px]"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input
                              value={l.lastName}
                              onChange={(e) => updateLead(l.id, { lastName: e.target.value })}
                              className="h-7 text-[11px]"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input
                              value={l.company}
                              onChange={(e) => updateLead(l.id, { company: e.target.value })}
                              className="h-7 text-[11px]"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input
                              value={l.position}
                              onChange={(e) => updateLead(l.id, { position: e.target.value })}
                              className="h-7 text-[11px]"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => removeLead(l.id)}
                              className="size-6 text-rose-600"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  {leads.length} recipient{leads.length === 1 ? "" : "s"}
                </p>
                <Button
                  size="sm"
                  onClick={() => go("Compose")}
                  disabled={leads.length === 0}
                  className="text-xs"
                >
                  Next: Compose
                  <ChevronRight className="ml-1 size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "Compose" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card className="border-foreground/10">
            <CardHeader>
              <CardTitle className="text-base">Recipients</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Click a row to write dedicated copy. {readyCount}/{leads.length} ready.
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px] rounded-lg border border-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Email</TableHead>
                      <TableHead className="text-[10px]">Name</TableHead>
                      <TableHead className="text-[10px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((l) => {
                      const m = messages[l.id];
                      const ready = !!(m?.subject?.trim() && m?.message?.trim());
                      return (
                        <TableRow
                          key={l.id}
                          onClick={() => setSelectedId(l.id)}
                          className={`cursor-pointer ${
                            selectedId === l.id ? "bg-primary/10" : "hover:bg-muted/40"
                          }`}
                        >
                          <TableCell className="py-1 font-mono text-[11px]">{l.email}</TableCell>
                          <TableCell className="py-1 text-[11px]">
                            {[l.firstName, l.lastName].filter(Boolean).join(" ") || "—"}
                          </TableCell>
                          <TableCell className="py-1">
                            {ready ? (
                              <CheckCircle2 className="size-3.5 text-emerald-600" />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">draft</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="mt-3 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => go("Import")}
                  className="text-xs"
                >
                  <ChevronLeft className="mr-1 size-3" />
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => go("Sender")}
                  disabled={leads.length === 0}
                  className="text-xs"
                >
                  Next: Sender
                  <ChevronRight className="ml-1 size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {selectedLead ? (
              <Card className="border-foreground/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Dedicated copy — {selectedLead.firstName || selectedLead.email}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedLead.email} · {selectedLead.position || "—"} at{" "}
                        {selectedLead.company || "—"}
                      </p>
                    </div>
                    <SafetyBadge
                      score={Math.min(selectedSubjectSan.safetyScore, selectedBodySan.safetyScore)}
                      violations={selectedViolations}
                    />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Subject</Label>
                    <Input
                      value={messages[selectedLead.id]?.subject ?? ""}
                      onChange={(e) => setMessage(selectedLead.id, { subject: e.target.value })}
                      placeholder="quick question for you"
                    />
                    {autoSanitize && selectedSubjectSan.violationsFound.length > 0 && (
                      <div className="text-[10px] text-amber-700">
                        Replaced:{" "}
                        {selectedSubjectSan.violationsFound
                          .map((v) => `"${v.trigger}" → "${v.replacement}"`)
                          .join("; ")}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Body (plain text)</Label>
                      <div className="flex flex-wrap items-center gap-1">
                        {VARIABLE_KEYS.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => insertResolvedVariable(selectedLead, v)}
                            className="rounded border border-foreground/10 bg-secondary px-1.5 py-0.5 text-[10px] hover:bg-secondary/70"
                            title={`Insert ${selectedLead[v.toLowerCase() as keyof Lead] || v}`}
                          >
                            {v}
                          </button>
                        ))}
                        <span className="text-[10px] text-muted-foreground">|</span>
                        {VARIABLE_KEYS.map((v) => (
                          <button
                            key={`tag-${v}`}
                            type="button"
                            onClick={() => insertMergeTag(v)}
                            className="rounded border border-foreground/10 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted"
                            title={`Insert merge tag {{.${v}}}`}
                          >
                            {`{{.${v}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      value={messages[selectedLead.id]?.message ?? ""}
                      onChange={(e) => setMessage(selectedLead.id, { message: e.target.value })}
                      placeholder="{Hi|Hello|Hey} {{.FirstName}}, I noticed your recent work at {{.Company}}..."
                      rows={10}
                      className="font-mono text-xs"
                    />
                    {autoSanitize && selectedBodySan.violationsFound.length > 0 && (
                      <div className="text-[10px] text-amber-700">
                        Auto-replaced:{" "}
                        {selectedBodySan.violationsFound
                          .slice(0, 6)
                          .map((v) => `"${v.trigger}" → "${v.replacement}"`)
                          .join("; ")}
                        {selectedBodySan.violationsFound.length > 6 ? "…" : ""}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => personalizeOne(selectedLead)}
                      disabled={personalizingId === selectedLead.id || !masterTemplate}
                      className="text-xs"
                    >
                      {personalizingId === selectedLead.id ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 size-3" />
                      )}
                      Personalize with Agent
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sanitizeOne(selectedLead)}
                      className="text-xs"
                    >
                      <Wand2 className="mr-1 size-3" />
                      Sanitize Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => showPreview(selectedLead)}
                      className="text-xs"
                    >
                      <Eye className="mr-1 size-3" />
                      Spintax Preview
                    </Button>
                  </div>

                  {selectedReport && <DeliverabilityMini report={selectedReport} />}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-foreground/10">
                <CardContent className="py-8 text-center text-xs text-muted-foreground">
                  Select a recipient on the left to write dedicated copy.
                </CardContent>
              </Card>
            )}

            <Card className="border-foreground/10">
              <CardHeader>
                <CardTitle className="text-base">AI personalization master template</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  A template with placeholders (e.g. {`{{.FirstName}}`}, {`{{.Company}}`}) used by
                  your existing agent to research each lead via Tavily and generate dedicated copy
                  for that lead.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Master subject (optional)</Label>
                  <Input
                    value={masterSubject}
                    onChange={(e) => setMasterSubject(e.target.value)}
                    placeholder="quick question about {{.Company}}"
                    className="text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Master template</Label>
                  <Textarea
                    value={masterTemplate}
                    onChange={(e) => setMasterTemplate(e.target.value)}
                    rows={6}
                    placeholder="{Hi|Hello|Hey} {{.FirstName}}, I noticed your recent work at {{.Company}}..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-3 text-xs">
                  <label className="flex items-center gap-2">
                    <Switch checked={autoSanitize} onCheckedChange={setAutoSanitize} />
                    Auto-sanitize on send
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={useWebSearch} onCheckedChange={setUseWebSearch} />
                    Tavily research
                  </label>
                  <span className="text-muted-foreground">Agent</span>
                  <Select value={agentSlug} onValueChange={(v) => v && setAgentSlug(v)}>
                    <SelectTrigger className="h-8 w-[200px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roster
                        .filter((a) =>
                          ["cold-outreach", "lead-research-assistant", "email-crawler", "lead-qualifier"].includes(a.slug)
                        )
                        .map((a) => (
                          <SelectItem key={a.slug} value={a.slug} className="text-xs">
                            {a.emoji ? `${a.emoji} ` : ""}
                            {a.name}
                          </SelectItem>
                        ))}
                      {roster.filter((a) =>
                        ["cold-outreach", "lead-research-assistant", "email-crawler", "lead-qualifier"].includes(a.slug)
                      ).length === 0 && (
                        <SelectItem value="cold-outreach" className="text-xs">
                          cold-outreach
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={personalizeAll}
                    disabled={personalizingAll || leads.length === 0 || !masterTemplate}
                    className="ml-auto text-xs"
                  >
                    {personalizingAll ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <FlaskConical className="mr-1 size-3" />
                    )}
                    Personalize ALL
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === "Sender" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-foreground/10">
            <CardHeader>
              <CardTitle className="text-base">Sender & schedule</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                GoPhish sending profile and landing page. Optionally schedule the launch.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Sending profile</Label>
                  <Select value={selectedProfile} onValueChange={(v) => v && setSelectedProfile(v)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder={optionsLoading ? "Loading…" : "Select profile"} />
                    </SelectTrigger>
                    <SelectContent>
                      {sendingProfiles.map((p) => (
                        <SelectItem key={p.name} value={p.name} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Landing page</Label>
                  <Select value={selectedPage} onValueChange={(v) => v && setSelectedPage(v)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder={optionsLoading ? "Loading…" : "Select page"} />
                    </SelectTrigger>
                    <SelectContent>
                      {landingPages.map((p) => (
                        <SelectItem key={p.name} value={p.name} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Campaign name (prefix)</Label>
                  <Input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="custom-email"
                    className="text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Group name (prefix)</Label>
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder={campaignName || "custom-email"}
                    className="text-xs"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Schedule (optional, ISO 8601)</Label>
                <Input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave empty to launch immediately.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-foreground/10 pt-3">
                <Button size="sm" variant="outline" onClick={() => go("Compose")} className="text-xs">
                  <ChevronLeft className="mr-1 size-3" />
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => go("Review")}
                  disabled={!selectedProfile || !selectedPage}
                  className="text-xs"
                >
                  Next: Review
                  <ChevronRight className="ml-1 size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-4">
            <AuthHealthBadge />
            <Card className="border-foreground/10">
              <CardHeader>
                <CardTitle className="text-base">Sending notes</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
                <p>
                  GoPhish executes randomized jitter and paced intervals between emails to mimic
                  human sending patterns.
                </p>
                <p>
                  Tanim.social and tanim.tech are protected with SPF, DKIM, DMARC, MTA-STS, and
                  TLS-RPT.
                </p>
                <p>
                  Dedicated per-recipient copy: each recipient gets their own GoPhish group and
                  template created from the dedicated subject and body you wrote.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === "Review" && (
        <div className="flex flex-col gap-4">
          <Card className="border-foreground/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Review</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {leads.length} recipient{leads.length === 1 ? "" : "s"} · {readyCount} ready
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Profile</span>
                <Badge variant="outline">{selectedProfile || "—"}</Badge>
                <span className="text-muted-foreground">Page</span>
                <Badge variant="outline">{selectedPage || "—"}</Badge>
                {scheduleDate && (
                  <Badge variant="outline">
                    Scheduled: {new Date(scheduleDate).toLocaleString()}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[420px] rounded-lg border border-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Email</TableHead>
                      <TableHead className="text-[10px]">Subject</TableHead>
                      <TableHead className="text-[10px]">Body preview</TableHead>
                      <TableHead className="text-[10px]">Safety</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((l) => {
                      const m = messages[l.id];
                      const subjRes = sanitizeSubjectLine(m?.subject ?? "");
                      const bodyRes = sanitizeOutreachEmail(m?.message ?? "");
                      const ready = !!(m?.subject?.trim() && m?.message?.trim());
                      const v = subjRes.violationsFound.length + bodyRes.violationsFound.length;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="py-1 font-mono text-[11px]">{l.email}</TableCell>
                          <TableCell className="py-1 text-[11px]">
                            {m?.subject || <span className="text-rose-600">missing</span>}
                          </TableCell>
                          <TableCell className="py-1 text-[11px]">
                            <span className="line-clamp-2 whitespace-pre-wrap">
                              {m?.message || (
                                <span className="text-rose-600">missing</span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="py-1">
                            {ready ? (
                              <SafetyBadge score={100} violations={[]} />
                            ) : (
                              <Badge className="border border-rose-300 bg-rose-100 text-rose-800">
                                <XCircle className="mr-1 size-3" />
                                Incomplete
                              </Badge>
                            )}
                            {ready && v > 0 && (
                              <div className="mt-1 text-[9px] text-amber-700">
                                {v} will be auto-replaced
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="mt-3 flex flex-col gap-3 border-t border-foreground/10 pt-3">
                <AuthHealthBadge />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={confirmSend}
                    onChange={(e) => setConfirmSend(e.target.checked)}
                    className="size-4"
                  />
                  I confirm sending {readyCount} dedicated email
                  {readyCount === 1 ? "" : "s"} to {readyCount} recipient
                  {readyCount === 1 ? "" : "s"} via {selectedProfile}.
                </label>
                <div className="flex items-center justify-between">
                  <Button size="sm" variant="outline" onClick={() => go("Sender")} className="text-xs">
                    <ChevronLeft className="mr-1 size-3" />
                    Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={send}
                    disabled={!allComposed || !confirmSend || sending}
                    className="text-xs"
                  >
                    {sending ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <Send className="mr-1 size-3" />
                    )}
                    Send {readyCount} email{readyCount === 1 ? "" : "s"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "Send" && (
        <div className="flex flex-col gap-4">
          <Card className="border-foreground/10">
            <CardHeader>
              <CardTitle className="text-base">Send results</CardTitle>
            </CardHeader>
            <CardContent>
              {results ? (
                <>
                  <div className="mb-3 flex items-center gap-3 text-xs">
                    <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">
                      {results.succeeded} sent
                    </Badge>
                    {results.failed > 0 && (
                      <Badge className="border border-rose-300 bg-rose-100 text-rose-800">
                        {results.failed} failed
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      of {results.total} total
                    </span>
                  </div>
                  <ScrollArea className="h-[420px] rounded-lg border border-foreground/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Email</TableHead>
                          <TableHead className="text-[10px]">Name</TableHead>
                          <TableHead className="text-[10px]">Status</TableHead>
                          <TableHead className="text-[10px]">Campaign</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.results.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="py-1 font-mono text-[11px]">{r.email}</TableCell>
                            <TableCell className="py-1 text-[11px]">
                              {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                            </TableCell>
                            <TableCell className="py-1">
                              {r.success ? (
                                <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">
                                  Sent
                                </Badge>
                              ) : (
                                <Badge
                                  className="border border-rose-300 bg-rose-100 text-rose-800"
                                  title={r.error}
                                >
                                  Failed
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-1 font-mono text-[10px] text-muted-foreground">
                              {r.campaignId ?? r.error ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">No results yet.</p>
              )}
              <div className="mt-3 flex items-center justify-end">
                <Button size="sm" variant="outline" onClick={() => go("Review")} className="text-xs">
                  Back to Review
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {previewFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-foreground/10 pb-3">
              <h3 className="text-sm font-semibold">
                Spintax preview ({previewFor.variations.length} variations)
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setPreviewFor(null)} className="text-xs">
                Close
              </Button>
            </div>
            <ScrollArea className="mt-3 max-h-[420px]">
              <div className="flex flex-col gap-3">
                {previewFor.variations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No spintax detected. Add patterns like {`{Hi|Hello|Hey}`} to generate
                    variations.
                  </p>
                ) : (
                  previewFor.variations.map((v, i) => (
                    <div key={i} className="rounded-lg border border-foreground/10 bg-muted/30 p-3">
                      <div className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
                        Variation {i + 1}
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-[11px]">{v}</pre>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
