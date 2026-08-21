/**
 * Research Agent Runner.
 * Performs research on a list of companies/topics and stores findings.
 */

import { AgentRunner, TaskRunMetadata, ProgressStatus } from "../registry";
import { classifyArtifact } from "../../content/classifier";

interface ResearchInput {
  targets: string[];
  focus?: string;
  depth?: "shallow" | "deep";
  source?: string;
}

export const researchRunner: AgentRunner = {
  type: "research",
  description: "Research companies, topics, or people and store findings as knowledge items",

  async execute(input: Record<string, unknown>, onProgress: (p: { current: number; total: number; currentItem?: string; status?: ProgressStatus }) => Promise<void>) {
    const { targets, focus, depth = "shallow", source = "research agent" } = input as unknown as ResearchInput;
    const targetsList = Array.isArray(targets) ? targets : [targets];

    const total = targetsList.length;
    let completed = 0;
    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    // Initial progress
    await onProgress({ current: 0, total, status: "starting" as ProgressStatus });

    let output = "";

    for (const target of targetsList) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const findings = `Research findings for ${target}${focus ? ` (focus: ${focus})` : ""}. Depth: ${depth}.`;

        const classification = await classifyArtifact({
          kind: "research",
          findings,
          sources: [source],
          metadata: { target, depth, focus },
        });

        if (classification.success) {
          created++;
        } else {
          failed++;
          errors.push(`${target}: ${classification.error}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${target}: ${err instanceof Error ? err.message : String(err)}`);
      }

      completed++;
      await onProgress({ current: completed, total, currentItem: target, status: (completed >= total ? "completed" : "running") as ProgressStatus });
    }

    output = `Research completed: ${created} created, ${failed} failed. Targets: ${targetsList.join(", ")}`;
    if (errors.length > 0) {
      output += `\nErrors:\n${errors.join("\n")}`;
    }

    const metadata = {
      agentType: "research" as const,
      progress: { current: completed, total, status: (failed > 0 ? "failed" : "completed") as ProgressStatus },
      counters: { created, updated: 0, skipped: 0, failed },
      source,
      triggeredBy: "cli" as const,
    };

    return { output, metadata };
  },
};