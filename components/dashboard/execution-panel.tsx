"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Terminal, Play, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TaskRun = {
  id: string;
  task_type: string;
  status: string;
  command: string | null;
  output: string | null;
  exit_code: number | null;
  started_at: string;
  completed_at: string | null;
  triggered_by: string | null;
};

export function ExecutionPanel() {
  const [command, setCommand] = useState("npm run sync");
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as TaskRun[];
        setRuns(data.slice(0, 50));
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadRuns();
    const supabase = createClient();
    const channel = supabase
      .channel("task_runs-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "task_runs" }, () => loadRuns())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRuns]);

  const execute = useCallback(async () => {
    if (!command.trim()) return;
    setRunning(true);
    try {
      const res = await fetch("/api/tasks/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: "script",
          command: command.trim(),
          triggered_by: "dashboard",
        }),
      });

      if (!res.ok) {
        toast.error("Failed to start task");
        return;
      }

      toast.success("Task started");
      await loadRuns();
    } catch {
      toast.error("Execution failed");
    } finally {
      setRunning(false);
    }
  }, [command, loadRuns]);

  useEffect(() => {
    outputRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [runs]);

  const latestRun = runs[0];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 bg-background/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Terminal className="size-4" />
          Backend Execution
        </div>
        <Badge variant="outline" className="text-xs">
          {running ? "Running" : "Idle"}
        </Badge>
      </div>

      <div className="flex gap-2">
        <Textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter command to run..."
          className="min-h-[60px] font-mono text-xs"
          disabled={running}
        />
        <Button onClick={execute} disabled={running || !command.trim()} className="self-end">
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Run
        </Button>
      </div>

      {latestRun && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-foreground/60">
            <span className="font-mono">{latestRun.command}</span>
            <span className="tabular-nums">{new Date(latestRun.started_at).toLocaleTimeString()}</span>
            <StatusBadge status={latestRun.status} />
          </div>
          {latestRun.output && (
            <div
              ref={outputRef}
              className="max-h-48 overflow-auto rounded-md border border-foreground/10 bg-black/80 p-3 font-mono text-xs text-green-400"
            >
              <pre className="whitespace-pre-wrap">{latestRun.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "border-brand/30 bg-brand-soft text-signal",
    completed: "border-signal/30 bg-signal/10 text-signal",
    failed: "border-red-500/30 bg-red-500/10 text-red-500",
  };
  return (
    <Badge variant="outline" className={styles[status] ?? ""}>
      {status}
    </Badge>
  );
}
