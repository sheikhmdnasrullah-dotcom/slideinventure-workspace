"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AgentInfo = {
  slug: string;
  name: string;
  label: string;
  description: string;
  emoji: string;
  color: string;
  strategy: string;
};

export function DeployAgentModal({
  open,
  onOpenChange,
  noteId,
  defaultTask,
  onDeployed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId?: string | null;
  defaultTask?: string;
  onDeployed?: (id: string) => void;
}) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [task, setTask] = useState(defaultTask ?? "");
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTask(defaultTask ?? "");
    setSelected([]);
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/agents/research/agents");
        const json = await res.json();
        setAgents(json.agents ?? []);
        setSelected((json.agents ?? []).map((a: AgentInfo) => a.slug).slice(0, 2));
      } catch {
        toast.error("Failed to load research agents");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, defaultTask]);

  const toggle = (slug: string) =>
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );

  const deploy = async () => {
    if (selected.length === 0) {
      toast.error("Select at least one research agent");
      return;
    }
    if (!task.trim()) {
      toast.error("Describe the research task");
      return;
    }
    setDeploying(true);
    try {
      const res = await fetch("/api/agents/research/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: selected, noteId: noteId ?? undefined, task: task.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Deployment failed");
      toast.success(noteId ? "Agents deployed into this note" : "Research super-agent deployed");
      onDeployed?.(json.id);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-5 text-primary" /> Deploy Agent
          </DialogTitle>
          <DialogDescription>
            {noteId
              ? "Send research agents into this note. They discuss the task round-robin and you can drop the conclusion back into the note."
              : "Deploy a research super-agent. The selected agents discuss your task and converge on a structured conclusion."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading agents…
            </div>
          ) : (
            agents.map((a) => {
              const active = selected.includes(a.slug);
              return (
                <button
                  key={a.slug}
                  type="button"
                  onClick={() => toggle(a.slug)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                  )}
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-lg"
                    style={{ backgroundColor: `${a.color}22` }}
                  >
                    {a.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      <Bot className="size-4 text-primary" /> {a.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{a.strategy}</span>
                    <span className="mt-1 block text-xs text-muted-foreground/80">{a.description}</span>
                  </span>
                  <span
                    className={cn(
                      "mt-1 size-4 shrink-0 rounded border",
                      active ? "border-primary bg-primary" : "border-muted-foreground/40"
                    )}
                  />
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Research task</label>
          <Textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. Compare the top 3 AI agent frameworks for our workflow and recommend one."
            className="min-h-20 text-sm"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={deploy} disabled={deploying || loading}>
            {deploying && <Loader2 className="size-4 animate-spin" />}
            Deploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
