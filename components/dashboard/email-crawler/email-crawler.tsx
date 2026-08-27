"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Search, ShieldCheck, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Verdict = "valid" | "invalid" | "unknown" | "error";

const VERDICT_STYLE: Record<Verdict, string> = {
  valid: "!bg-emerald-500/10 !text-emerald-500 !border-emerald-500/20",
  invalid: "!bg-red-500/10 !text-red-500 !border-red-500/20",
  unknown: "!bg-zinc-500/10 !text-zinc-400 !border-zinc-500/20",
  error: "!bg-amber-500/10 !text-amber-500 !border-amber-500/20",
};

export function EmailCrawler() {
  const [link, setLink] = useState("");
  const [details, setDetails] = useState("");
  const [instructions, setInstructions] = useState("");
  const [running, setRunning] = useState(false);
  const [raw, setRaw] = useState("");
  const [results, setResults] = useState<
    { email: string; source: string; verdict: Verdict; leadId?: string | null }[]
  >([]);
  const [imported, setImported] = useState(0);

  const run = useCallback(async () => {
    if (!link.trim() && !details.trim()) {
      toast.error("Give a link or prospect details");
      return;
    }
    setRunning(true);
    setResults([]);
    setRaw("");
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
      toast.success(`Found ${data.emails.length} email(s), ${data.imported} imported as leads`);
    } catch (e) {
      toast.error("Crawl failed");
    } finally {
      setRunning(false);
    }
  }, [link, details, instructions]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" /> Prospect Finder
          </CardTitle>
          <CardDescription>
            Drop a link and/or details about a prospect. The agent surfs the web,
            solves any CAPTCHA with 2captcha, and returns the prospect&apos;s email.
            No prerequisites. It starts immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground/50">Prospect link (optional)</label>
            <Input
              placeholder="https://linkedin.com/in/... or company site"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground/50">Prospect details</label>
            <Textarea
              placeholder="Name, company, role, anything you know about the prospect…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground/50">Extra instructions (optional)</label>
            <Textarea
              placeholder="e.g. prefer personal email, check the team page first…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={run} disabled={running} className="self-start">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {running ? "Surfing the web…" : "Crawl for email"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4" /> Found emails
            </CardTitle>
            <CardDescription>
              Verified with TrueMail. {imported} new lead(s) imported into Leads.
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
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-foreground/70">
              {raw}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
