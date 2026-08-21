"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles } from "lucide-react";

export function ResearchPanel() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runResearch = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/tasks/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: "research",
          command: `research: ${query}`,
          triggered_by: "dashboard",
          metadata: { query },
        }),
      });

      if (!res.ok) {
        toast.error("Failed to start research");
        return;
      }

      toast.success("Research started — check activity feed");
    } catch {
      toast.error("Research failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 bg-background/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4" />
          Prospect / Market Research
        </div>
        <Badge variant="outline" className="text-xs">
          {running ? "Researching..." : "Ready"}
        </Badge>
      </div>

      <Textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Describe what to research: e.g. 'Top 20 SaaS founders in Dubai', 'Cold email benchmarks for agency outreach'..."
        className="min-h-[80px] text-sm"
        disabled={running}
      />

      <Button onClick={runResearch} disabled={running || !query.trim()} className="self-end">
        {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Start Research
      </Button>

      {result && (
        <div className="rounded-md border border-foreground/10 bg-background/80 p-3 text-sm whitespace-pre-wrap">
          {result}
        </div>
      )}
    </div>
  );
}
