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
import { Loader2, Send, CircleCheck, CircleX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RosterAgent } from "@/lib/agents/roster";
import { AgentIcon } from "@/components/dashboard/agent-icon";

type ChatMessage = { role: "user" | "assistant"; content: string };

type LogEntry = { level: "info" | "success" | "error"; text: string };

const LOG_ICON: Record<LogEntry["level"], LucideIcon | null> = {
  info: null,
  success: CircleCheck,
  error: CircleX,
};

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
  const [durable, setDurable] = useState(false);
  const [toolLog, setToolLog] = useState<LogEntry[]>([]);

  const messages = agent ? (messagesByAgent[agent.slug] ?? []) : [];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function runViaTemporal(slug: string, message: string) {
    const start = await fetch("/api/temporal/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, message }),
    });
    const startData = await start.json();
    if (!start.ok) throw new Error(startData?.error ?? "Failed to start durable run");
    const workflowId: string = startData.workflowId;
    setToolLog((prev) => [...prev, { level: "info", text: `Temporal workflow started: ${workflowId}` }]);

    let status = "RUNNING";
    let result: string | null = null;
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      const poll = await fetch(`/api/temporal/run?workflowId=${encodeURIComponent(workflowId)}`);
      const pollData = await poll.json();
      status = pollData.status;
      if (status === "COMPLETED") {
        result = pollData.result;
        break;
      }
      if (status === "FAILED" || status === "CANCELED" || status === "TERMINATED" || status === "TIMED_OUT") {
        throw new Error(`Temporal workflow ${status}`);
      }
    }
    if (result == null) throw new Error("Temporal workflow did not finish in time");
    return result;
  }

  async function send() {
    if (!agent || !input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const history = messages;
    setMessagesByAgent((prev) => ({ ...prev, [agent.slug]: [...history, userMsg] }));
    setInput("");
    setError(null);
    setLoading(true);
    try {
      if (durable) {
        const answer = await runViaTemporal(agent.slug, userMsg.content);
        setMessagesByAgent((prev) => ({
          ...prev,
          [agent.slug]: [...(prev[agent.slug] ?? []), { role: "assistant", content: answer }],
        }));
        setToolLog((prev) => [...prev, { level: "success", text: `${agent.name} finished via Temporal (durable)` }]);
        return;
      }

      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: agent.slug, message: userMsg.content, history, tools }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Agent chat failed");
      if (Array.isArray(data.tools) && data.tools.length) {
        setToolLog((prev) => [...prev, { level: "info", text: `${agent.name} used: ${data.tools.join(", ")}` }]);
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
                <AgentIcon slug={agent.slug} className="mr-2 size-4 text-ink-strong" />
                {agent.name}
              </SheetTitle>
              <SheetDescription>{agent.description}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 space-y-3" data-lenis-prevent>
              {messages.length === 0 && (
                <p className="font-body text-sm text-ink-faint">
                  Send a message to work with this agent. It responds in-character using its
                  persona prompt. No chat history is saved after you close this panel.
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
                  <Loader2 className="size-3.5 animate-spin" /> Thinking
                </div>
              )}
              {error && <p className="text-sm text-[var(--status-danger)]">{error}</p>}
            </div>

            <SheetFooter>
              <label className="flex items-center gap-2 text-xs text-ink-muted pb-2">
                <input
                  type="checkbox"
                  checked={durable}
                  onChange={(e) => setDurable(e.target.checked)}
                  className="accent-[var(--text-accent)]"
                />
                Durable run via Temporal (DeepSeek‑powered, resumable)
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-muted pb-2">
                <input
                  type="checkbox"
                  checked={tools}
                  onChange={(e) => setTools(e.target.checked)}
                  className="accent-[var(--text-accent)]"
                />
                Tools (Mastra): retrieve, browse, remember, recall
              </label>
              {toolLog.length > 0 && (
                <div className="flex flex-col gap-1 pb-2">
                  {toolLog.map((e, i) => {
                    const Icon = LOG_ICON[e.level];
                    return (
                      <p
                        key={i}
                        className={cn(
                          "flex items-center gap-1.5 font-label text-[10px]",
                          e.level === "error" ? "text-destructive" : "text-ink-faint",
                        )}
                      >
                        {Icon && <Icon className="size-3 shrink-0" />}
                        <span>{e.text}</span>
                      </p>
                    );
                  })}
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
                  placeholder={`Ask ${agent.name}`}
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
