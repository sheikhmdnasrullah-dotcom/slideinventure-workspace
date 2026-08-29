"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Verdict = "valid" | "invalid" | "unknown" | "error";

const VERDICT_STYLE: Record<Verdict, string> = {
  valid: "!bg-emerald-500/10 !text-emerald-500 !border-emerald-500/20",
  invalid: "!bg-red-500/10 !text-red-500 !border-red-500/20",
  unknown: "!bg-zinc-500/10 !text-zinc-400 !border-zinc-500/20",
  error: "!bg-amber-500/10 !text-amber-500 !border-amber-500/20",
};

export function ReacherPanel() {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ email: string; status: Verdict; detail?: string }[]>([]);

  const run = useCallback(async () => {
    const emails = input
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!emails.length) {
      toast.error("Paste at least one email");
      return;
    }
    setRunning(true);
    setResults([]);
    try {
      const resp = await fetch("/api/verify/reacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data.error || "Verification failed");
        return;
      }
      setResults(data.results);
      toast.success(`Verified ${data.results.length} email(s) via Reacher`);
    } catch {
      toast.error("Verification failed");
    } finally {
      setRunning(false);
    }
  }, [input]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" /> Reacher Verification
          </CardTitle>
          <CardDescription>
            Verify email deliverability through your VPS Reacher engine.
          </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Textarea
          placeholder="Paste emails, one per line or comma-separated"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
        />
        <Button onClick={run} disabled={running} className="self-start">
          {running ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {running ? "Verifying" : "Verify with Reacher"}
        </Button>

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <div
                key={r.email}
                className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2"
              >
                <span className="text-sm font-medium">{r.email}</span>
                <Badge variant="outline" className={VERDICT_STYLE[r.status as Verdict]}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
