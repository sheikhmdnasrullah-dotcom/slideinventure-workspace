import "server-only";
import { getSession, updateSession, type ResearchStatus } from "./store";
import { getResearchPersona } from "./personas";
import { runResearchTick, CONVERGE_PREFIX } from "./tick";

// Round-robin multi-agent orchestrator. Each tick advances to the next agent in
// the session's agent list; that agent reads the shared scratchpad and
// contributes. The loop ends when an agent emits a "FINAL CONCLUSION:" block or
// we hit MAX_TICKS. Runs server-side (via waitUntil or a worker) so it
// completes even if the browser is closed.
const MAX_TICKS = 6;

export async function runResearchSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  if (session.status === "done" || session.status === "error") return;
  if (session.status === "running") return; // avoid a second concurrent run

  let turns = [...session.turns];
  await updateSession(sessionId, { status: "running" });

  try {
    const agents = session.agents;
    if (agents.length === 0) throw new Error("no agents in session");

    let idx = turns.length % agents.length;
    let tick = turns.length + 1;

    while (turns.length < MAX_TICKS) {
      const ref = agents[idx];
      const persona = getResearchPersona(ref.slug);
      if (!persona) {
        idx = (idx + 1) % agents.length;
        continue;
      }

      const text = await runResearchTick({
        persona,
        agentLabel: ref.label,
        task: session.task,
        turns,
        tick,
        totalAgents: agents.length,
      });

      turns.push({ agentSlug: ref.slug, agentLabel: ref.label, text, tick });
      await updateSession(sessionId, { turns });

      if (text.includes(CONVERGE_PREFIX)) {
        const conclusion = text.split(CONVERGE_PREFIX, 2)[1]?.trim() || text;
        await updateSession(sessionId, { status: "done", conclusion });
        return;
      }

      idx = (idx + 1) % agents.length;
      tick += 1;
    }

    // Reached the tick cap without an explicit conclusion: use the last
    // substantive contribution as the working conclusion.
    const last = turns[turns.length - 1]?.text ?? "";
    await updateSession(sessionId, { status: "done", conclusion: last });
  } catch (e) {
    console.error("runResearchSession failed", sessionId, e);
    await updateSession(sessionId, { status: "error" as ResearchStatus });
  }
}
