import { requireUser } from "@/lib/supabase/server";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { PageHeader, Section, Surface, Badge } from "@/components/system";
import { AgentType } from "@/lib/agents/registry";
import { getAgentRoster, getAgentDivisions } from "@/lib/agents/roster";
import { AgentIconGrid } from "@/components/dashboard/agent-icon-grid";
import { cn } from "@/lib/utils";

const DB = APPWRITE.databaseId;
const RUNS = APPWRITE.collections.taskRuns;
const EVENTS = APPWRITE.collections.taskRunEvents;

function parseJson(v: unknown): Record<string, unknown> {
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return {}; }
  }
  return (v as Record<string, unknown>) ?? {};
}

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

  const runsRes = await databases.listDocuments(DB, RUNS, [
    Query.orderDesc("started_at"),
    Query.limit(50),
  ]);

  const runs = runsRes.documents.map((d: any) => ({
    id: d.$id,
    task_type: d.task_type,
    status: d.status,
    command: d.command,
    output: d.output,
    exit_code: d.exit_code,
    started_at: d.started_at,
    completed_at: d.completed_at,
    triggered_by: d.triggered_by,
    metadata: parseJson(d.metadata),
  })) as TaskRun[];

  // Replicate the `task_run_latest_progress` view: latest event (max sequence) per task_run_id.
  const progressMap = new Map<string, ProgressEvent>();
  if (runs.length) {
    const evRes = await databases.listDocuments(DB, EVENTS, [
      Query.equal("task_run_id", runs.map((r) => r.id)),
      Query.limit(5000),
    ]);
    const best = new Map<string, any>();
    for (const e of evRes.documents) {
      const cur = best.get(e.task_run_id);
      if (!cur || e.sequence > cur.sequence) best.set(e.task_run_id, e);
    }
    for (const [k, v] of best) {
      progressMap.set(k, {
        task_run_id: v.task_run_id,
        current: v.current,
        total: v.total,
        current_item: v.current_item ?? null,
        status: v.status,
        created_at: v.created_at,
      });
    }
  }

  // Get running tasks
  const running = runs.filter((r) => r.status === "running");
  const completed = runs.filter((r) => r.status !== "running").slice(0, 20);

  const roster = getAgentRoster();
  const rosterDivisions = getAgentDivisions(roster);

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
                        {run.command ?? "–"}
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
                        {duration !== null ? `${duration}s` : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Surface>
      </Section>

      {/* Agent roster */}
      <Section tone="base">
        <PageHeader
          eyebrow="Roster"
          title="Agent roster"
          meta={roster.length > 0 ? `${roster.length} specialist agents across ${rosterDivisions.length} divisions — click one to open its visual canvas` : undefined}
        />
        <Surface variant="raised">
          {roster.length === 0 ? (
            <p className="font-body text-sm text-ink-muted py-4">
              No agents configured yet.
            </p>
          ) : (
            <>
              <p className="font-body text-sm text-ink-muted pb-4">
                Each agent opens a visual workflow canvas. Describe a task in plain English and the
                agent builds the node graph (research → reason → output) and runs it. The same
                personas also live in{" "}
                <code className="font-mono text-xs bg-[var(--surface-2)] px-1.5 py-0.5 rounded">.claude/agents/</code>.
              </p>
              <AgentIconGrid agents={roster} />
            </>
          )}
        </Surface>
      </Section>
    </div>
  );
}