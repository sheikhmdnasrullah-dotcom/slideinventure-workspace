"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import {
  Brain,
  NotebookPen,
  PenTool,
  FolderOpen,
  Bot,
  Trash2,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Terminal,
  Code2,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLiveRefresh } from "@/components/providers/event-stream";
import { registerContextProvider, unregisterContextProvider } from "@/lib/agents/context-registry";
import { formatDistanceToNow } from "date-fns";

type ResearchLabSource =
  | "notepad"
  | "brainstorm"
  | "files"
  | "agent"
  | "chat"
  | "terminal"
  | "editor"
  | "external";

type ResearchLabItem = {
  id: string;
  source: ResearchLabSource;
  sourceRef: string;
  title: string;
  summary: string;
  reference: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
};

const SOURCE_META: Record<
  ResearchLabSource,
  { label: string; icon: typeof NotebookPen; color: string }
> = {
  editor: { label: "From VS Code", icon: Code2, color: "text-sky-500" },
  terminal: { label: "From Terminal", icon: Terminal, color: "text-lime-500" },
  external: { label: "From other AI tools", icon: Globe, color: "text-fuchsia-500" },
  notepad: { label: "From Notepad", icon: NotebookPen, color: "text-amber-500" },
  brainstorm: { label: "From Brainstorm", icon: PenTool, color: "text-blue-500" },
  files: { label: "From Files", icon: FolderOpen, color: "text-purple-500" },
  agent: { label: "From Agents", icon: Bot, color: "text-emerald-500" },
  chat: { label: "From AI Query & Chat", icon: MessageSquare, color: "text-cyan-500" },
};

const SOURCE_ORDER: ResearchLabSource[] = [
  "editor",
  "terminal",
  "external",
  "notepad",
  "brainstorm",
  "files",
  "agent",
  "chat",
];

export function AvResearch() {
  const [, setTab] = useQueryState("tab");
  const [, setNotePath] = useQueryState("note");
  const [, setBoardPath] = useQueryState("board");
  const [, setBoardEngine] = useQueryState("boardEngine");
  const [, setFilePath] = useQueryState("path");

  const [items, setItems] = useState<ResearchLabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/items");
      if (!res.ok) throw new Error("Could not load the Brain");
      const json = await res.json();
      setItems(json.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the Brain");
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/brain/sync", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        if (json.items) {
          setItems(json.items);
          setError(null);
        }
      }
    } catch {
      // best effort
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setTimeout(() => {
      void sync();
    }, 1500);
    return () => clearTimeout(t);
  }, [load, sync]);

  useLiveRefresh(load, { sources: ["research-lab"] });

  // Expose the current Brain items to the deployed agent so dropping an
  // agent here hands it the real content, not just the section title.
  useEffect(() => {
    registerContextProvider("research", () => {
      if (!items.length) return null;
      return {
        title: "Brain",
        content: items.map((i) => `• ${i.title}\n${i.summary}`).join("\n\n"),
      };
    });
    return () => unregisterContextProvider("research");
  }, [items]);

  const openSource = (item: ResearchLabItem) => {
    const ref = item.reference;
    if (!ref?.tab) return;
    void setTab(ref.tab);
    if (ref.tab === "notepad" && ref.note) void setNotePath(ref.note);
    if (ref.tab === "brainstorm" && ref.board) {
      void setBoardPath(ref.board);
      void setBoardEngine(ref.engine || "excalidraw");
    }
    if (ref.tab === "files" && ref.path) void setFilePath(ref.path);
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/brain/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Brain item removed");
    } catch {
      setItems(prev);
      toast.error("Could not remove this item");
    } finally {
      setDeletingId(null);
    }
  };

  const grouped = SOURCE_ORDER.map((source) => ({
    source,
    items: items.filter((i) => i.source === source),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      data-droppable="research"
      data-drop-title="Brain"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-6 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Brain</h2>
          </div>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Everything you research, captured automatically: VS Code, terminal, other AI tools, notes, sketches, files, agent findings, and chat.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active 10s auto-push</span>
          </div>

          <Button
            size="xs"
            variant="outline"
            onClick={sync}
            disabled={syncing}
            className="h-7 gap-1.5 text-xs shadow-xs"
          >
            <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Now"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin text-primary" /> Loading the Brain
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground/60 ring-1 ring-border">
            <Sparkles className="size-7 text-primary/70" />
          </div>
          <p className="text-sm font-semibold text-ink-strong">The Brain is empty so far</p>
          <p className="max-w-md text-xs leading-relaxed">
            Research in VS Code or the terminal (run <code className="rounded bg-muted px-1">npm run brain:watch</code>), write in Notepad, sketch in Brainstorm, upload a file, or ask in AI Query. Core ideas are summarized into bullet points and pushed here automatically every 10 seconds.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={sync}
            disabled={syncing}
            className="mt-2 gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            Check and push now
          </Button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto" data-lenis-prevent>
          <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 pb-24">
            {grouped.map(({ source, items: sourceItems }) => {
              const meta = SOURCE_META[source];
              const Icon = meta.icon;
              return (
                <section key={source} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Icon className={`size-4 ${meta.color}`} />
                      <span>{meta.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {sourceItems.length} item{sourceItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {sourceItems.map((item) => (
                      <div
                        key={item.id}
                        className="group flex flex-col gap-2 rounded-xl border border-border bg-card/70 p-4 transition-all duration-150 hover:border-primary/40 hover:bg-card hover:shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {item.title}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {item.reference?.tab && (
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => openSource(item)}
                                title="Open in original section"
                                className="size-7"
                              >
                                <ExternalLink className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => remove(item.id)}
                              disabled={deletingId === item.id}
                              title="Remove summary"
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Structured Bullet Point Summary */}
                        <div className="whitespace-pre-line text-xs leading-relaxed text-foreground/80 font-normal space-y-1">
                          {item.summary}
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground/70">
                          <span>Updated {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}</span>
                          {item.reference?.tab && (
                            <button
                              onClick={() => openSource(item)}
                              className="hover:text-primary transition-colors cursor-pointer"
                            >
                              Go to {item.reference.tab} →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
