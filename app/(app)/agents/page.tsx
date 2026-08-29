import { requireUser } from "@/lib/supabase/server";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { PageHeader, Section, Surface, StatusBadge } from "@/components/system";
import { AgentType } from "@/lib/agents/registry";
import { getAgentRoster, getAgentDivisions } from "@/lib/agents/roster";
import { AgentIconGrid } from "@/components/dashboard/agent-icon-grid";
import { MastraAgentsPanel } from "@/components/dashboard/agents/mastra-agents-panel";
import { AgentHistoryTable, type AgentHistoryRow } from "@/components/dashboard/agents/agent-history-table";
import { SiteHeader } from "@/components/dashboard/site-header";
import { AgentModesGrid } from "@/components/dashboard/agents/agent-modes-grid";

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

  // These read the task-run collections, which may not exist in every
  // deployment. Never let a failure here take down the whole Agents section —
  // the roster is file-based and must always render.
  let runs: TaskRun[] = [];
  try {
    const runsRes = await databases.listDocuments(DB, RUNS, [
      Query.orderDesc("started_at"),
      Query.limit(50),
    ]);
    runs = runsRes.documents.map((d: any) => ({
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
  } catch {
    runs = [];
  }

  // Replicate the `task_run_latest_progress` view: latest event (max sequence) per task_run_id.
  const progressMap = new Map<string, ProgressEvent>();
  if (runs.length) {
    try {
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
    } catch {
      // progress stays empty
    }
  }

  // Get running tasks
  const running = runs.filter((r) => r.status === "running");
  const completed = runs.filter((r) => r.status !== "running").slice(0, 20);

  const roster = getAgentRoster();
  const rosterDivisions = getAgentDivisions(roster);

  return (
    <>
      <SiteHeader crumbs={[{ label: "Agents" }]} subtitle="Execution workspace" />
      <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        eyebrow="Intelligence"
        title="Agents"
        meta={`${running.length} running, ${runs.length} total runs`}
      />

      {/* Agent Frameworks & Dedicated Modes */}
      <Section tone="base">
        <PageHeader eyebrow="Frameworks" title="Agent Modes" />
        <AgentModesGrid />
      </Section>

      {/* Mastra Agents — self-hosted runtime on the VPS */}
      <MastraAgentsPanel />

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
                        <StatusBadge tone="live" dot label="Running" />
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
        <Surface variant="raised" className="px-0 py-0">
          <AgentHistoryTable
            data={completed.map((run): AgentHistoryRow => {
              const started = new Date(run.started_at);
              const ended = run.completed_at ? new Date(run.completed_at) : null;
              const duration = ended ? Math.round((ended.getTime() - started.getTime()) / 1000) : null;
              return {
                id: run.id,
                task_type: run.task_type,
                command: run.command,
                status: run.status,
                started_at: run.started_at,
                duration,
              };
            })}
          />
        </Surface>
      </Section>

      {/* Agent roster */}
      <Section tone="base">
        <PageHeader
          eyebrow="Roster"
          title="Agent roster"
          meta={roster.length > 0 ? `${roster.length} specialist agents across ${rosterDivisions.length} divisions. Click one to open its visual canvas` : undefined}
        />
        <Surface variant="raised">
          {roster.length === 0 ? (
            <p className="font-body text-sm text-ink-muted py-4">
              No agents configured yet.
            </p>
          ) : (
            <>
              <p className="font-body text-sm text-ink-muted pb-4">
                Each persona is defined as a file in{" "}
                <code className="font-mono text-xs bg-[var(--surface-2)] px-1.5 py-0.5 rounded">.claude/agents/</code>.
              </p>
              <AgentIconGrid agents={roster} />
            </>
          )}
        </Surface>
      </Section>
      </div>
    </>
  );
}