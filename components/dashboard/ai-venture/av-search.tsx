"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type Hit = { type: string; id: string; title: string; snippet: string; updatedAt: string };

export function AvSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-venture/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.results ?? []);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Search boards, notes, docs, research…"
        />
        <Button size="sm" onClick={run} disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2">
          {results.map((r, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded bg-accent px-1.5 py-0.5 uppercase text-muted-foreground">{r.type}</span>
                <span className="font-medium">{r.title}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.snippet}</p>
            </div>
          ))}
          {results.length === 0 && q && !busy && (
            <p className="text-xs text-muted-foreground">No results.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
