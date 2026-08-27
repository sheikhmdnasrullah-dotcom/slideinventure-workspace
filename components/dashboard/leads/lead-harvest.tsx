"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type HarvestResult = {
  ok: boolean;
  harvested: number;
  candidates: number;
  emails: string[];
  error?: string;
};

export function LeadHarvest() {
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<HarvestResult | null>(null);

  async function run() {
    if (!topic.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/leads/harvest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "harvest failed");
      setResult(data);
      toast.success(`Harvested ${data.harvested} new leads`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "harvest failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-rule bg-surface p-4">
      <div className="flex items-center gap-2">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="YouTube niche (e.g. AI automation agencies)"
          className="max-w-md"
          disabled={running}
        />
        <Button onClick={run} disabled={running || !topic.trim()}>
          {running ? "Harvesting" : "Harvest leads"}
        </Button>
      </div>
      <p className="text-xs text-foreground/40">
        Drives the Browse agent over YouTube, solves CAPTCHAs it meets, and imports found channel
        emails as leads. Can take a minute or two.
      </p>
      {result && (
        <div className="text-sm">
          <p className="text-foreground/60">
            {result.ok
              ? `${result.harvested} new leads imported (${result.candidates} candidate emails found).`
              : `Failed: ${result.error}`}
          </p>
          {result.emails?.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-foreground/50">
              {result.emails.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
