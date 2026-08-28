"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { toast } from "sonner";
import { Search, Upload, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ResearchOutcome } from "@/lib/leads/research";

async function postResearch(body: { mode: "describe"; text: string } | { mode: "rows"; rows: Record<string, string>[] }) {
  const res = await fetch("/api/leads/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ResearchOutcome;
  if (!res.ok || !json.ok) throw new Error(json.error || "Research failed");
  return json;
}

function ResultSummary({ outcome }: { outcome: ResearchOutcome }) {
  return (
    <p className="font-body text-sm text-ink-muted">
      {outcome.created} lead{outcome.created === 1 ? "" : "s"} created
      {outcome.updated > 0 ? `, ${outcome.updated} enriched` : ""}
      {outcome.skipped > 0 ? ` — ${outcome.skipped} skipped (no real email found)` : ""}.
    </p>
  );
}

/**
 * The assistant's actual working surface: two tabs (free-text / CSV), no
 * required fields either way. Framing-agnostic so it can sit inside a Dialog
 * (Leads page) or embedded directly in a page (Agent Canvas).
 */
export function LeadResearchAssistantPanel() {
  const queryClient = useQueryClient();
  const [describeText, setDescribeText] = useState("");
  const [csvRows, setCsvRows] = useState<Record<string, string>[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastOutcome, setLastOutcome] = useState<ResearchOutcome | null>(null);

  const invalidateLeads = () => queryClient.invalidateQueries({ queryKey: ["leads", "list"] });

  const describeMutation = useMutation({
    mutationFn: () => postResearch({ mode: "describe", text: describeText }),
    onSuccess: (outcome) => {
      setLastOutcome(outcome);
      toast.success(`Research complete: ${outcome.created + outcome.updated} lead${outcome.created + outcome.updated === 1 ? "" : "s"} touched`);
      void invalidateLeads();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Research failed"),
  });

  const csvMutation = useMutation({
    mutationFn: () => postResearch({ mode: "rows", rows: csvRows ?? [] }),
    onSuccess: (outcome) => {
      setLastOutcome(outcome);
      toast.success(`Research complete: ${outcome.created + outcome.updated} lead${outcome.created + outcome.updated === 1 ? "" : "s"} touched`);
      void invalidateLeads();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Research failed"),
  });

  const handleCsvSelect = (file: File | undefined) => {
    if (!file) return;
    setCsvFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setCsvRows(results.data),
      error: () => toast.error("Could not read that CSV file"),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Tabs defaultValue="describe">
        <TabsList className="w-full">
          <TabsTrigger value="describe">Describe or add a lead</TabsTrigger>
          <TabsTrigger value="csv">Upload CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="describe" className="flex flex-col gap-3 pt-3">
          <Textarea
            value={describeText}
            onChange={(e) => setDescribeText(e.target.value)}
            placeholder={'Anything at all: "SaaS founders in fintech, Bangladesh" or a single lead you have partial info on — a name, a company, a LinkedIn URL, a half-remembered email.'}
            rows={5}
            disabled={describeMutation.isPending}
          />
          <Button
            onClick={() => describeMutation.mutate()}
            disabled={!describeText.trim() || describeMutation.isPending}
            className="self-end"
          >
            <Search className="size-3.5" />
            {describeMutation.isPending ? "Researching…" : "Research"}
          </Button>
        </TabsContent>

        <TabsContent value="csv" className="flex flex-col gap-3 pt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleCsvSelect(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-md border border-dashed border-rule-strong p-6 text-center transition-colors hover:bg-[var(--surface-2)]/50"
          >
            <Upload className="size-5 text-ink-faint" />
            <span className="font-body-tight text-sm text-ink-strong">
              {csvFileName ?? "Click to choose a CSV file"}
            </span>
            <span className="font-body text-xs text-ink-muted">
              {csvRows ? `${csvRows.length} row${csvRows.length === 1 ? "" : "s"} loaded — any columns work` : "Any columns work. Partial rows are fine."}
            </span>
          </button>
          <Button
            onClick={() => csvMutation.mutate()}
            disabled={!csvRows?.length || csvMutation.isPending}
            className="self-end"
          >
            <Search className="size-3.5" />
            {csvMutation.isPending ? "Researching…" : `Research ${csvRows?.length ?? 0} row${csvRows?.length === 1 ? "" : "s"}`}
          </Button>
        </TabsContent>
      </Tabs>

      {lastOutcome && <ResultSummary outcome={lastOutcome} />}
    </div>
  );
}

export function LeadResearchAssistant({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--text-accent)]" />
            Lead Research Assistant
          </DialogTitle>
          <DialogDescription>
            Give it whatever you already know. No required fields — it researches the rest.
          </DialogDescription>
        </DialogHeader>
        <LeadResearchAssistantPanel />
      </DialogContent>
    </Dialog>
  );
}
