"use client";

import { useEffect, useState, useMemo } from "react";
import { Sparkles, Loader2, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deployAgent,
  deployAgentToNotepad,
  type DeployableAgent,
  type NoteContext,
} from "@/lib/agents/deployed-agent-store";
import { toast } from "sonner";

type DeployAgentPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteContext?: NoteContext | null;
};

export function DeployAgentPalette({ open, onOpenChange, noteContext }: DeployAgentPaletteProps) {
  const [agents, setAgents] = useState<DeployableAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      return;
    }
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/agents/deployable");
        const data = await res.json();
        if (isMounted) {
          setAgents(data.agents ?? []);
        }
      } catch {
        if (isMounted) toast.error("Failed to load agents");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const handleSelectAgent = (agent: DeployableAgent) => {
    if (noteContext && noteContext.id) {
      deployAgentToNotepad(agent, noteContext);
      toast.success(`${agent.name} deployed into this note!`, {
        description: "Agent attached to note. Use the companion card to analyze or research.",
      });
    } else {
      deployAgent(agent);
      toast.success(`${agent.name} is on screen as a circle icon!`, {
        description: "Hold & drag to drop onto your Notepad, Brainstorm, or anywhere on screen.",
      });
    }
    onOpenChange(false);
  };

  const categories = useMemo(() => {
    const counts: Record<string, number> = { all: agents.length };
    agents.forEach((a) => {
      const cat = a.category || "knowledge";
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return [
      { id: "all", label: "All", count: counts.all || 0 },
      { id: "research", label: "Deep Research", count: counts.research || 0 },
      { id: "outbound", label: "Leads & Outbound", count: counts.outbound || 0 },
      { id: "crawler", label: "Web Crawlers", count: counts.crawler || 0 },
      { id: "knowledge", label: "Knowledge", count: counts.knowledge || 0 },
    ];
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesCategory =
        selectedCategory === "all" || agent.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        agent.name.toLowerCase().includes(q) ||
        (agent.description && agent.description.toLowerCase().includes(q)) ||
        (agent.strategy && agent.strategy.toLowerCase().includes(q)) ||
        (agent.slug && agent.slug.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [agents, selectedCategory, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <Sparkles className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Deploy an Agent
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                  {noteContext && noteContext.id
                    ? `Deploy directly into "${noteContext.title || "this note"}".`
                    : "Spawn as a floating circular avatar. Drag to deploy into Notepad, Brainstorm, or anywhere on screen."}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by agent name, skill, or strategy…"
              className="pl-9 pr-8 text-xs bg-muted/40 border-border/60 h-9 rounded-lg"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Category filter tabs */}
          <div className="flex items-center gap-1.5 pt-3 overflow-x-auto" data-lenis-prevent>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                  selectedCategory === c.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{c.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                    selectedCategory === c.id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-muted-foreground"
                  }`}
                >
                  {c.count}
                </span>
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Circular Agent Grid */}
        <div className="p-6 max-h-[440px] overflow-y-auto" data-lenis-prevent>
          {loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span>Loading available agents…</span>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-sm text-muted-foreground gap-1">
              <span>No agents match your search.</span>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="text-xs text-primary underline underline-offset-2"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3.5">
              {filteredAgents.map((agent) => {
                const color = agent.color || "#6366f1";
                return (
                  <button
                    key={agent.slug}
                    type="button"
                    onClick={() => handleSelectAgent(agent)}
                    className="group relative flex flex-col items-center gap-2 p-2.5 rounded-2xl border border-transparent hover:border-border/80 hover:bg-muted/40 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {/* Circle Icon */}
                    <div
                      className="relative flex size-15 items-center justify-center rounded-full text-2xl shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:ring-4"
                      style={{
                        backgroundColor: `${color}16`,
                        borderColor: color,
                        boxShadow: `0 6px 20px -4px ${color}35`,
                      }}
                    >
                      <span>{agent.emoji || "🤖"}</span>
                      {/* Hover ring */}
                      <span
                        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ring-2"
                        style={{ borderColor: color }}
                      />
                    </div>

                    {/* Agent Name & Tag */}
                    <div className="flex flex-col items-center text-center w-full">
                      <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {agent.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1 pt-0.5 px-1">
                        {agent.strategy || agent.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info tip */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-3 text-xs text-muted-foreground">
          <span>Tip: Hold down the circle icon on screen anytime to dock it back to the navbar.</span>
          <Button variant="ghost" size="xs" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
