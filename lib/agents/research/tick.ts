import "server-only";
import { deepseekChat } from "./deepseek";
import type { ResearchPersona } from "./personas";
import type { ResearchTurn } from "./store";

const CONVERGE_PREFIX = "FINAL CONCLUSION:";

// One round-robin turn for a single research agent. It reads the shared
// scratchpad (everyone's prior turns) and contributes. If it decides the group
// has enough, it returns a "FINAL CONCLUSION:" block.
export async function runResearchTick(opts: {
  persona: ResearchPersona;
  agentLabel: string;
  task: string;
  turns: ResearchTurn[];
  tick: number;
  totalAgents: number;
}): Promise<string> {
  const scratchpad = opts.turns.length
    ? opts.turns
        .map((t) => `**${t.agentLabel}** (tick ${t.tick}):\n${t.text}`)
        .join("\n\n---\n\n")
    : "(empty — you are opening the discussion)";

  const user = `RESEARCH TASK:
${opts.task}

SHARED SCRATCHPAD (contributions from the other agents so far):
${scratchpad}

You are **${opts.agentLabel}** (${opts.persona.name}), one of ${opts.totalAgents} research agents in this round-robin discussion. This is tick ${opts.tick}. Read the scratchpad and add YOUR contribution: extend or challenge prior points, never just repeat them. If the group has enough to conclude, respond with a block that begins exactly with "${CONVERGE_PREFIX}" followed by a structured report (## Summary, ## Key Findings, ## Recommended Action).`;

  const text = await deepseekChat(
    [
      { role: "system", content: opts.persona.systemPrompt },
      { role: "user", content: user },
    ],
    { temperature: 0.7, maxTokens: 1600 }
  );
  return text.trim();
}

export { CONVERGE_PREFIX };
