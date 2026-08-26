"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Send } from "lucide-react";
import type { RosterAgent } from "@/lib/agents/roster";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AgentRunSheet({
  agent,
  onOpenChange,
}: {
  agent: RosterAgent | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState(false);
  const [toolLog, setToolLog] = useState<string[]>([]);

  const messages = agent ? (messagesByAgent[agent.slug] ?? []) : [];

  async function send() {
    if (!agent || !input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const history = messages;
    setMessagesByAgent((prev) => ({ ...prev, [agent.slug]: [...history, userMsg] }));
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: agent.slug, message: userMsg.content, history, tools }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Agent chat failed");
      if (Array.isArray(data.tools) && data.tools.length) {
        setToolLog((prev) => [...prev, `🔧 ${agent.name} used: ${data.tools.join(", ")}`]);
      }
      setMessagesByAgent((prev) => ({
        ...prev,
        [agent.slug]: [...(prev[agent.slug] ?? []), { role: "assistant", content: data.answer }],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={!!agent} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {agent && (
          <>
            <SheetHeader>
              <SheetTitle>
                <span className="mr-2">{agent.emoji ?? "🤖"}</span>
                {agent.name}
              </SheetTitle>
              <SheetDescription>{agent.description}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 space-y-3">
              {messages.length === 0 && (
                <p className="font-body text-sm text-ink-faint">
                  Send a message to work with this agent. It responds in-character using its
                  persona prompt — no chat history is saved after you close this panel.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-sm px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-[var(--surface-2)] text-ink-strong ml-6"
                      : "bg-[var(--accent-wash)] text-ink-default mr-2"
                  )}
                >
                  {m.content}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-ink-faint text-sm">
                  <Loader2 className="size-3.5 animate-spin" /> Thinking…
                </div>
              )}
              {error && <p className="text-sm text-[var(--status-danger)]">{error}</p>}
            </div>

            <SheetFooter>
              <label className="flex items-center gap-2 text-xs text-ink-muted pb-2">
                <input
                  type="checkbox"
                  checked={tools}
                  onChange={(e) => setTools(e.target.checked)}
                  className="accent-[var(--text-accent)]"
                />
                Tools (Mastra) — retrieve, browse, remember, recall
              </label>
              {toolLog.length > 0 && (
                <div className="flex flex-col gap-1 pb-2">
                  {toolLog.map((t, i) => (
                    <p key={i} className="font-label text-[10px] text-ink-faint">{t}</p>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`Ask ${agent.name}…`}
                  className="min-h-16 resize-none"
                  disabled={loading}
                />
                <Button size="icon" onClick={send} disabled={loading || !input.trim()}>
                  <Send className="size-4" />
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
