"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AvPdfAsk() {
  const [docs, setDocs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((j) => {
        const all = j.data ?? [];
        setDocs(all.filter((d: any) => d.workspace === "ai-venture"));
      })
      .catch(() => {});
  }, []);

  const ask = async () => {
    if (!selected || !question.trim()) return;
    setBusy(true);
    setAnswer("");
    try {
      const res = await fetch("/api/ai-venture/pdf-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selected, question }),
      });
      const json = await res.json();
      setAnswer(json.answer ?? JSON.stringify(json));
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full grid-cols-[280px_1fr] gap-3">
      <div className="flex flex-col rounded-lg border border-border">
        <div className="border-b border-border px-2 py-1.5 text-xs font-medium">AI Venture PDFs</div>
        <ScrollArea className="flex-1 p-1">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={`flex w-full items-center gap-1 rounded px-1 py-1 text-left text-xs hover:bg-accent ${
                selected === d.id ? "bg-accent" : ""
              }`}
            >
              <span className="truncate">{d.title || d.filename}</span>
            </button>
          ))}
          {docs.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No PDFs yet.</p>}
        </ScrollArea>
      </div>
      <div className="flex flex-col rounded-lg border border-border">
        <div className="border-b border-border px-2 py-1.5 text-xs">
          {selected ? "Ask a question" : "Select a PDF"}
        </div>
        <div className="flex flex-col gap-2 p-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this PDF…"
            className="min-h-20 text-xs"
          />
          <Button size="sm" onClick={ask} disabled={!selected || !question.trim() || busy}>
            {busy ? "Asking…" : "Ask"}
          </Button>
          {answer && (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-[var(--surface-2)] p-3 text-xs">
              {answer}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
