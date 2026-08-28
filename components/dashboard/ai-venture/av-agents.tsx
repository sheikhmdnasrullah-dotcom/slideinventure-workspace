"use client";

import { useEffect, useReducer, useState } from "react";
import { Bot, Send, Loader2, X, FileCode2, Globe, Wrench, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLiveEvents } from "@/components/providers/event-stream";
import { agentStatusLabel } from "@/lib/agui/protocol";
import type { DomainEvent } from "@/lib/events/types";
import {
  getAgentState,
  getStoreSnapshot,
  subscribe,
  updateAgentState,
  type AgentMsg,
} from "@/lib/agents/conversation-store";

type Agent = {
  slug: string;
  name: string;
  description: string;
  division: string;
  team: string | null;
  emoji: string | null;
  color: string | null;
};

// Talks to one installed agent persona (`.claude/agents/<slug>.md`). The roster
// can legitimately be empty; in that case we say so plainly. Conversations live
// in a module-level store (lib/agents/conversation-store), so a run keeps going
// and stays visible even when you switch agents or leave the section, and
// survives a page reload via localStorage. Agents run with tools on by default
// (web search, knowledge retrieval, browsing, integrations, memory).
export function AvAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [input, setInput] = useState("");
  const [tools, setTools] = useState(true);
  const [background, setBackground] = useState(true);

  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => subscribe(force), []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) throw new Error("Could not load agents");
        const json = await res.json();
        if (active) setAgents(json.agents ?? []);
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : "Could not load agents");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const { events } = useLiveEvents({ types: ["agent."] });

  // Reflect live run status onto the right agent tile (matched by runId) so a
  // background run shows progress even when you're not looking at that agent.
  useEffect(() => {
    const snap = getStoreSnapshot();
    for (const e of events as DomainEvent[]) {
      const rid = e.metadata?.runId as string | undefined;
      if (!rid) continue;
      for (const slug of Object.keys(snap)) {
        if (snap[slug].runId !== rid) continue;
        const label = agentStatusLabel(e.type, e.metadata);
        if (e.type === "agent.completed" || e.type === "agent.failed") {
          updateAgentState(slug, { status: label, busy: false });
        } else if (label) {
          updateAgentState(slug, { status: label });
        }
      }
    }
  }, [events]);

  const selectAgent = (agent: Agent) => {
    setSelected(agent);
    setInput("");
  };

  const selectedState = selected ? getAgentState(selected.slug) : null;
  const busy = selectedState?.busy ?? false;

  const send = async () => {
    const text = input.trim();
    if (!text || !selected || busy) return;
    setInput("");
    const slug = selected.slug;
    const prior = getAgentState(slug).messages;
    const userMsg: AgentMsg = { role: "user", content: text };
    updateAgentState(slug, {
      messages: [...prior, userMsg],
      busy: true,
      status: "Working",
      answer: null,
      error: null,
    });

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, message: text, history: prior, tools }),
      });
      if (res.status === 503) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "No LLM provider is configured for this workspace.");
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "The agent request failed.");
      }
      const json = await res.json();
      const ans = json.answer ?? "";
      updateAgentState(slug, {
        runId: json.runId ?? null,
        answer: ans,
        messages: [...getAgentState(slug).messages, { role: "assistant", content: ans }],
        status: "Done",
        busy: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The agent request failed.";
      updateAgentState(slug, { error: msg, busy: false });
      toast.error(msg);
    }
  };

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-card/40 p-2">
        <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Agents
        </div>
        <ScrollArea className="flex-1" data-lenis-prevent>
          {loading ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Loading</p>
          ) : loadError ? (
            <div className="flex flex-col gap-2 px-2 py-3">
              <p className="text-xs text-destructive">{loadError}</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col gap-2 px-2 py-3">
              <p className="text-xs text-muted-foreground">
                No agents installed. Personas come from agent files in{" "}
                <code className="rounded bg-muted px-1">.claude/agents/*.md</code>. Add one and it
                shows up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 p-1">
              {agents.map((a) => {
                const st = getAgentState(a.slug);
                return (
                  <button
                    key={a.slug}
                    title={a.name}
                    onClick={() => selectAgent(a)}
                    className={cn(
                      "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border p-1 text-center transition-colors hover:bg-accent",
                      selected?.slug === a.slug
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    )}
                  >
                    <span className="text-xl leading-none">{a.emoji || <Bot className="size-5" />}</span>
                    <span className="line-clamp-1 w-full px-0.5 text-[10px] font-medium">
                      {a.name}
                    </span>
                    {st.busy && (
                      <span className="absolute right-1 top-1">
                        <Loader2 className="size-3 animate-spin text-primary" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="h-full overflow-y-auto p-6" data-lenis-prevent>
            <div className="mb-1 flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Agents</h2>
            </div>
            <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
              Pick an agent to delegate work. They run with tools on by default — web search, your
              knowledge base, browsing, connected integrations and memory — and can keep working in the
              background while you do other things.
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-muted-foreground">
                <FileCode2 className="size-8" />
                <p className="text-sm">No agents installed yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {agents.map((a) => {
                  const st = getAgentState(a.slug);
                  return (
                    <button
                      key={a.slug}
                      onClick={() => selectAgent(a)}
                      className="group relative flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-primary"
                    >
                      <span
                        className="flex size-12 items-center justify-center rounded-full text-2xl"
                        style={{
                          backgroundColor: a.color ? `${a.color}22` : "hsl(var(--muted))",
                        }}
                      >
                        {a.emoji || <Bot className="size-6" />}
                      </span>
                      <span className="font-medium">{a.name}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {a.description || a.division}
                      </span>
                      {st.busy && (
                        <span className="absolute right-2 top-2 flex items-center gap-1 text-[10px] text-primary">
                          <Loader2 className="size-3 animate-spin" /> running
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
              <span className="text-sm font-medium">{selected.name}</span>
              <span className="text-xs text-muted-foreground">{selected.division}</span>
              <div className="ml-auto flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="size-3.5" />
                  <input
                    type="checkbox"
                    checked={tools}
                    onChange={(e) => setTools(e.target.checked)}
                    className="size-3.5"
                  />
                  Tools
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wrench className="size-3.5" />
                  <input
                    type="checkbox"
                    checked={background}
                    onChange={(e) => setBackground(e.target.checked)}
                    className="size-3.5"
                  />
                  Background
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4" data-lenis-prevent>
              {selectedState && selectedState.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ask {selected.name} anything. It has tools: web search, your knowledge base, browsing,
                  connected integrations and memory.
                </p>
              ) : (
                <div className="mx-auto flex max-w-2xl flex-col gap-3">
                  {selectedState?.messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedState?.status && (
                <div className="mx-auto mt-3 flex max-w-2xl items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className={cn("size-3", busy && "animate-spin")} />
                  {selectedState.status}
                  {background && busy && <span>· running in background</span>}
                </div>
              )}
              {selectedState?.error && (
                <p className="mx-auto mt-3 max-w-2xl text-sm text-destructive">
                  {selectedState.error}
                </p>
              )}
            </div>

            <div className="flex items-end gap-2 border-t border-border p-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message ${selected.name}`}
                className="min-h-10 flex-1 resize-none text-sm"
              />
              <Button size="icon" onClick={send} disabled={busy || !input.trim()}>
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
