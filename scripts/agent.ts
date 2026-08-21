#!/usr/bin/env tsx
/**
 * Agent CLI - run typed agents from the command line.
 * Usage: npm run agent research -- --targets "company1,company2" --focus "pricing"
 */

import { createClient } from "@supabase/supabase-js";
import { agentRegistry, AgentType, ProgressPayload } from "../lib/agents/registry";
import { createIncrementalReporter, completeTaskRun } from "../lib/agents/progress";
import { startTaskRun } from "../lib/tasks/logger";

interface CliArgs {
  agentType: AgentType;
  targets?: string;
  focus?: string;
  depth?: string;
  source?: string;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    agentType: "research",
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--targets" || arg === "-t") {
      result.targets = args[++i];
    } else if (arg === "--focus" || arg === "-f") {
      result.focus = args[++i];
    } else if (arg === "--depth" || arg === "-d") {
      result.depth = args[++i];
    } else if (arg === "--source" || arg === "-s") {
      result.source = args[++i];
    } else if (!arg.startsWith("-")) {
      // First positional arg is agent type
      if (Object.values(["research", "company_analysis", "sop_author", "outreach_research", "file_process", "script", "cold_email", "automation", "system"]).includes(arg)) {
        result.agentType = arg as any;
      }
    }
  }

  return result;
}

function printHelp() {
  console.log(`
Usage: npm run agent <agent-type> [options]

Agent types:
  research         Research companies, topics, or people
  company_analysis Analyze company data (coming soon)
  sop_author       Create SOPs from templates (coming soon)
  outreach_research Research for cold outreach (coming soon)

Options:
  --targets, -t    Comma-separated list of targets (companies, topics, etc.)
  --focus, -f      Research focus area (e.g., "pricing", "competitors")
  --depth, -d      Research depth: "shallow" | "deep" (default: "shallow")
  --source, -s     Source attribution (default: "cli")
  --help, -h       Show this help

Examples:
  npm run agent research -- -t "Acme Corp,Globex Inc" -f "pricing"
  npm run agent research -- --targets "Acme Corp" --depth deep
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const runner = agentRegistry.get(args.agentType);
  if (!runner) {
    console.error(`Unknown agent type: ${args.agentType}`);
    console.error("Available types:", agentRegistry.list().map((r) => r.type).join(", "));
    process.exit(1);
  }

  // Parse targets
  const targets = args.targets?.split(",").map((t) => t.trim()).filter(Boolean) || [];
  if (targets.length === 0 && args.agentType === "research") {
    console.error("Research agent requires --targets");
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Start task run
  const runId = await startTaskRun({
    task_type: args.agentType,
    command: `npm run agent ${args.agentType} ${process.argv.slice(2).join(" ")}`,
  });

  const total = args.targets ? args.targets.split(",").length : 1;
  const reportProgress = async (progress: { current: number; currentItem?: string; status?: "starting" | "running" | "completed" | "failed" }) => {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabase2 = createClient2(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { createIncrementalReporter } = await import("../lib/agents/progress");
    const reporter = createIncrementalReporter(supabase2, runId, 100);
    await reporter();
  };

  try {
    console.log(`Starting ${args.agentType} agent (run: ${runId})`);
    console.log(`Targets: ${targets.join(", ")}`);

    const result = await agentRegistry.get(args.agentType)!.execute(
      {
        targets,
        focus: args.focus,
        depth: args.depth ?? "shallow",
        source: args.source ?? "cli",
      },
      async (progress) => {
        // Progress is handled by the agent internally
      }
    );

    await completeTaskRun(
      supabase,
      runId,
      "completed",
      result.output,
      0,
      result.metadata
    );

    console.log("\n✅ Agent completed successfully");
    console.log(result.output);
    process.exit(0);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("\n❌ Agent failed:", error.message);

    await completeTaskRun(
      supabase,
      runId,
      "failed",
      error.message,
      1,
      { agentType: args.agentType }
    );
    process.exit(1);
  }
}

main();