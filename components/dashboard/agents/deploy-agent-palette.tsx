"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles, X, Loader2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (!open) return;
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
    if (noteContext) {
      deployAgentToNotepad(agent, noteContext);
      toast.success(`${agent.name} deployed into this note!`, {
        description: "Agent attached. Use the companion card to analyze or research.",
      });
    } else {
      deployAgent(agent);
      toast.success(`${agent.name} is on screen as a circle icon!`, {
        description: "Hold & drag to drop onto your Notepad, canvas, or anywhere on screen.",
      });
    }
    onOpenChange(false);
  };

  const categories = [
    { id: "all", label: "All Agents" },
    { id: "research", label: "Deep Research" },
    { id: "outbound", label: "Leads & Outbound" },
    { id: "crawler", label: "Web Crawlers" },
    { id: "knowledge", label: "Knowledge" },
  ];

  const filteredAgents =
    selectedCategory === "all"
      ? agents
      : agents.filter((a) => a.category === selectedCategory);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Deploy an Agent
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            {noteContext
              ? `Select an agent to deploy into "${noteContext.title || "this note"}".`
              : "Select an agent to spawn as a floating circle icon. Hold and drag it anywhere on screen or drop it directly into your notes."}
          </DialogDescription>

          {/* Category filter tabs */}
          <div className="flex items-center gap-1.5 pt-3 overflow-x-auto" data-lenis-prevent>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  selectedCategory === c.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {c.label}
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
            <div className="flex h-36 flex-col items-center justify-center text-sm text-muted-foreground">
              No agents found in this category.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {filteredAgents.map((agent) => {
                const color = agent.color || "#6366f1";
                return (
                  <button
                    key={agent.slug}
                    type="button"
                    onClick={() => handleSelectAgent(agent)}
                    className="group relative flex flex-col items-center gap-2.5 p-3 rounded-2xl border border-transparent hover:border-border/80 hover:bg-muted/40 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {/* Circle Icon */}
                    <div
                      className="relative flex size-16 items-center justify-center rounded-full text-2xl shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:ring-4"
                      style={{
                        backgroundColor: `${color}18`,
                        borderColor: color,
                        boxShadow: `0 8px 24px -4px ${color}35`,
                      }}
                    >
                      <span>{agent.emoji || "🤖"}</span>
                      {/* Active glowing ring on hover */}
                      <span
                        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ring-2"
                        style={{ borderColor: color }}
                      />
                    </div>

                    {/* Agent Name & Tag */}
                    <div className="flex flex-col items-center text-center">
                      <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {agent.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[100px] pt-0.5">
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
          <span>Tip: You can drag the circle icon anywhere or hold it to dock back to the navbar.</span>
          <Button variant="ghost" size="xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
