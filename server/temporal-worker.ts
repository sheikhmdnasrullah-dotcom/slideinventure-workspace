import { Worker } from "@temporalio/worker";
import * as activities from "../temporal/activities";
import { runAgentTask } from "../temporal/workflow";

// Temporal worker process. Run with tsx (the repo already uses tsx for scripts):
//   tsx server/temporal-worker.ts
// Requires TEMPORAL_ADDRESS and INTERNAL_API_TOKEN env vars (see deploy/setup-vps.sh).
async function run() {
  if (!process.env.TEMPORAL_ADDRESS) {
    console.error("[temporal-worker] TEMPORAL_ADDRESS not set — refusing to start.");
    process.exit(1);
  }
  const worker = await Worker.create({
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || "workspace-tasks",
    workflowsPath: require.resolve("../temporal/workflow"),
    activities,
  });
  console.log(`[temporal-worker] listening on task queue "${worker.options.taskQueue}"`);
  await worker.run();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
