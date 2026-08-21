import { requireUser, createServiceClient } from "@/lib/supabase/server";
import { PageHeader, Section, Surface, Badge } from "@/components/system";
import { AgentType } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";

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
  metadata: Record<string, unknown>;
};

type ProgressEvent = {
  task_run_id: string;
  current: number;
  total: number;
  current_item: string | null;
  status: string;
  created_at: string;
};

export default async function AgentsPage() {
  await requireUser();

  const supabase = createServiceClient();

  const [{ data: runsData }, { data: progressData }] = await Promise.all([
    supabase
      .from("task_runs")
      .select("id, task_type, status, command, output, exit_code, started_at, completed_at, triggered_by, metadata")
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("task_run_latest_progress")
      .select("task_run_id, current, total, current_item, status, created_at"),
  ]);

  const runs = (runsData ?? []) as TaskRun[];
  const progressMap = new Map((progressData ?? []).map((p: ProgressEvent) => [p.task_run_id, p]));

  // Get running tasks
  const running = runs.filter((r) => r.status === "running");
  const completed = runs.filter((r) => r.status !== "running").slice(0, 20);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        eyebrow="Intelligence"
        title="Agents"
        meta={`${running.length} running, ${runs.length} total runs`}
      />

      {/* Live agents */}
      <Section tone="base">
        <PageHeader eyebrow="Live agents" title="Running executions" />
        <Surface variant="inset">
          {running.length === 0 ? (
            <p className="font-body text-sm text-ink-muted py-4">
              No agents running. Start one from the command line:
              <code className="ml-2 font-mono text-xs bg-[var(--surface-2)] px-1.5 py-0.5 rounded">npm run agent research --targets "Acme Corp"</code>
            </p>
          ) : (
            <div className="space-y-2">
              {running.map((run) => {
                const prog = progressMap.get(run.id);
                return (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 p-3 rounded-sm bg-[var(--surface-2)] ring-1 ring-rule"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-ink-strong">{run.task_type}</span>
                        <Badge variant="outline" className="border-[var(--status-live)]/30 bg-[color-mix(in_oklch,var(--status-live)_10%,transparent)] text-[var(--status-live)]">
                          Running
                        </Badge>
                      </div>
                      <p className="font-body text-sm text-ink-muted mt-1 truncate">{run.command ?? "Agent execution"}</p>
                      {prog && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--text-accent)] transition-all duration-300 ease-expo"
                              style={{ width: `${Math.min(100, (prog.current / Math.max(1, prog.total)) * 100)}%` }}
                            />
                          </div>
                          <span className="font-label text-[10px] text-ink-muted tabular-nums">
                            {prog.current} / {prog.total}
                            {prog.current_item && ` · ${prog.current_item}`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="font-label text-[10px] text-ink-faint whitespace-nowrap">
                      {new Date(run.started_at).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      </Section>

      {/* History */}
      <Section tone="base">
        <PageHeader eyebrow="History" title="Recent agent runs" />
        <Surface variant="raised">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left py-2 px-3 font-label text-ink-muted">Type</th>
                  <th className="text-left py-2 px-3 font-label text-ink-muted">Command</th>
                  <th className="text-center py-2 px-3 font-label text-ink-muted">Status</th>
                  <th className="text-right py-2 px-3 font-label text-ink-muted">Started</th>
                  <th className="text-right py-2 px-3 font-label text-ink-muted">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {completed.map((run) => {
                  const started = new Date(run.started_at);
                  const ended = run.completed_at ? new Date(run.completed_at) : null;
                  const duration = ended ? Math.round((ended.getTime() - started.getTime()) / 1000) : null;
                  return (
                    <tr key={run.id} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs">
                          {run.task_type}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-ink-muted truncate max-w-xs">
                        {run.command ?? "—"}
                      </td>
                      <td className="text-center py-2 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            run.status === "completed" && "border-[var(--status-live)]/30 bg-[color-mix(in_oklch,var(--status-live)_10%,transparent)] text-[var(--status-live)]",
                            run.status === "failed" && "border-[var(--status-danger)]/30 bg-[color-mix(in_oklch,var(--status-danger)_10%,transparent)] text-[var(--status-danger)]",
                            run.status === "running" && "border-[var(--status-live)]/30 bg-[color-mix(in_oklch,var(--status-live)_10%,transparent)] text-[var(--status-live)] animate-pulse",
                          )}
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-3 font-label text-[10px] text-ink-muted">
                        {started.toLocaleTimeString()}
                      </td>
                      <td className="text-right py-2 px-3 font-label text-[10px] text-ink-muted tabular-nums">
                        {duration !== null ? `${duration}s` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Surface>
      </Section>
    </div>
  );
}