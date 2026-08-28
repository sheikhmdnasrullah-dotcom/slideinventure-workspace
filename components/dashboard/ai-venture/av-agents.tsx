"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Bot, Send, Loader2, X, FileCode2, Globe, Wrench, Layers, Sparkles } from "lucide-react";
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
  const [research, setResearch] = useState<
    { id: string; task: string; status: string; agents: { slug: string; label: string }[]; conclusion: string | null }[]
  >([]);

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

  // Standalone research super-agents (deployed without a note) show up here so
  // they're reachable from the Agents section like any other agent.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/agents/research/sessions");
        const json = await res.json();
        if (!active) return;
        const all = json.sessions ?? [];
        setResearch(all.filter((s: any) => !s.noteId));
      } catch {
        /* non-fatal */
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

  // Resume tracking a background job when the agent is (re)selected, e.g. after
  // navigating away and coming back, or reopening the dashboard.
  useEffect(() => {
    const slug = selected?.slug;
    if (!slug) return;
    const st = getAgentState(slug);
    if (st.busy && st.jobId) startPoll(slug, st.jobId);
    return () => stopPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.slug]);

  const selectedState = selected ? getAgentState(selected.slug) : null;
  const busy = selectedState?.busy ?? false;

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollJob = async (slug: string, jobId: string) => {
    try {
      const res = await fetch(`/api/agents/jobs/${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "done") {
        const ans = data.answer ?? "";
        const st = getAgentState(slug);
        updateAgentState(slug, {
          messages: [...st.messages, { role: "assistant", content: ans }],
          answer: ans,
          status: "Done",
          busy: false,
          jobId: null,
        });
        stopPoll();
      } else if (data.status === "error") {
        updateAgentState(slug, { error: data.error || "Agent run failed", busy: false, jobId: null });
        stopPoll();
      } else {
        updateAgentState(slug, { status: data.status === "running" ? "Running" : "Queued" });
      }
    } catch {
      /* keep polling */
    }
  };

  const startPoll = (slug: string, jobId: string) => {
    stopPoll();
    pollRef.current = setInterval(() => {
      void pollJob(slug, jobId);
    }, 2000);
  };

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
      status: background ? "Queued" : "Working",
      answer: null,
      error: null,
    });

    // Background mode: hand the run to the server-side queue. It runs on Vercel
    // independent of this tab and keeps going even if the browser/machine closes.
    if (background) {
      try {
        const res = await fetch("/api/agents/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, message: text, history: prior, tools }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "Could not start the background agent.");
        }
        const json = await res.json();
        updateAgentState(slug, { jobId: json.id, status: "Queued" });
        startPoll(slug, json.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "The agent request failed.";
        updateAgentState(slug, { error: msg, busy: false, jobId: null });
        toast.error(msg);
      }
      return;
    }

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
    <div className="flex h-full flex-col">
      {!selected ? (
        <div className="h-full overflow-y-auto p-6" data-lenis-prevent>
          <div className="mb-1 flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Agents</h2>
          </div>
          <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
            Select an agent to delegate work. Agents run with tools enabled by default (web search, knowledge base, browsing, integrations, and memory) and can continue working in the background.
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
                    className="group relative flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-5 text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
                  >
                    <span
                      className="flex size-14 items-center justify-center rounded-2xl text-2xl shadow-xs"
                      style={{
                        backgroundColor: a.color ? `${a.color}22` : "hsl(var(--muted))",
                      }}
                    >
                      {a.emoji || <Bot className="size-7" />}
                    </span>
                    <span className="font-semibold text-sm text-ink-strong">{a.name}</span>
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
              }              )}
            </div>
          )}

          {research.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-ink-strong">Research super-agents</h3>
                <span className="text-xs text-muted-foreground">multi-agent deep research</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {research.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-strong line-clamp-1">{r.task}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-2 py-0.5 text-[10px]",
                          r.status === "done"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : r.status === "error"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-primary/15 text-primary"
                        )}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.agents.map((a) => (
                        <span key={a.slug} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {a.label}
                        </span>
                      ))}
                    </div>
                    {r.conclusion && (
                      <p className="line-clamp-3 text-xs text-muted-foreground">{r.conclusion}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(null)}
                className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ← All Agents
              </Button>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{selected.emoji || <Bot className="size-4" />}</span>
                <span className="text-sm font-semibold text-foreground">{selected.name}</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {selected.division}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <Globe className="size-3.5" />
                <input
                  type="checkbox"
                  checked={tools}
                  onChange={(e) => setTools(e.target.checked)}
                  className="size-3.5 rounded"
                />
                Tools
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <Wrench className="size-3.5" />
                <input
                  type="checkbox"
                  checked={background}
                  onChange={(e) => setBackground(e.target.checked)}
                  className="size-3.5 rounded"
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
                  {selectedState?.jobId && busy && <span>· running in background</span>}
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
    </div>
  );
}
