"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DeployAgentModal } from "./deploy-agent-modal";

type Turn = { agentSlug: string; agentLabel: string; text: string; tick: number };
type Session = {
  id: string;
  status: "pending" | "running" | "done" | "error";
  task: string;
  agents: { slug: string; label: string }[];
  turns: Turn[];
  conclusion: string | null;
  noteId: string | null;
};

async function appendToNote(noteId: string, text: string) {
  const res = await fetch(`/api/notes/${noteId}`);
  const data = await res.json();
  const raw = data?.note?.content;
  let doc: any = null;
  try {
    doc = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    doc = null;
  }
  if (!doc || !Array.isArray(doc.content)) {
    doc = { type: "doc", content: [] };
  }
  doc.content = doc.content || [];
  doc.content.push({
    type: "heading",
    attrs: { level: 3 },
    content: [{ type: "text", text: "Research conclusion" }],
  });
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    doc.content.push({ type: "paragraph", content: [{ type: "text", text: t }] });
  }
  const put = await fetch(`/api/notes/${noteId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: JSON.stringify(doc) }),
  });
  if (!put.ok) throw new Error("Could not save to note");
}

export function ResearchPanel({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [deployOpen, setDeployOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const loadSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/agents/research/sessions/${id}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.session as Session;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const existing = await (async () => {
          const res = await fetch(`/api/agents/research/sessions?noteId=${encodeURIComponent(noteId)}`);
          const json = await res.json();
          return json.session as Session | null;
        })();
        if (active && existing) {
          setSession(existing);
          if (existing.status === "running" || existing.status === "pending") {
            startPoll(existing.id);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      stopPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const startPoll = (id: string) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      const s = await loadSession(id);
      if (!s) return;
      setSession(s);
      if (s.status === "done" || s.status === "error") stopPoll();
    }, 2000);
  };

  const onDeployed = (id: string) => {
    setSession(null);
    (async () => {
      const s = await loadSession(id);
      if (s) {
        setSession(s);
        if (s.status === "running" || s.status === "pending") startPoll(id);
      }
    })();
  };

  const insert = async () => {
    if (!session?.conclusion) return;
    try {
      await appendToNote(noteId, session.conclusion);
      toast.success("Conclusion added to note");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to insert");
    }
  };

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l bg-card/40">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" /> Research Agents
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-7" title="New research" onClick={() => setDeployOpen(true)}>
            <Plus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : !session ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <Bot className="size-8 text-primary/60" />
          <p>No research running for this note yet.</p>
          <Button size="sm" onClick={() => setDeployOpen(true)}>
            <Plus className="size-4" /> Deploy agents
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1" data-lenis-prevent>
          <div className="space-y-3 p-3">
            <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Task:</span> {session.task}
            </div>
            {session.turns.map((t, i) => (
              <div key={i} className="rounded-lg border p-2 text-sm">
                <div className="mb-1 text-xs font-semibold text-primary">{t.agentLabel}</div>
                <div className="whitespace-pre-wrap text-foreground/90">{t.text}</div>
              </div>
            ))}
            {session.status === "running" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> agents discussing…
              </div>
            )}
            {session.conclusion && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-2">
                <div className="mb-1 text-xs font-semibold text-primary">Conclusion</div>
                <div className="whitespace-pre-wrap text-sm">{session.conclusion}</div>
                <Button size="sm" className="mt-2" onClick={insert}>
                  Insert into note
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <DeployAgentModal
        open={deployOpen}
        onOpenChange={setDeployOpen}
        noteId={noteId}
        onDeployed={onDeployed}
      />
    </div>
  );
}
