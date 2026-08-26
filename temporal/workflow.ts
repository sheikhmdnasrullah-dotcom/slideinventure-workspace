import { workflow, proxyActivities } from "@temporalio/workflow";
import type * as acts from "./activities";

const { executeViaApi } = proxyActivities<typeof acts>({
  startToCloseTimeout: "10 minutes",
});

export const runAgentTask = workflow.execute(async (input: unknown) => {
  await executeViaApi(input as { task: string; startUrl?: string; userEmail?: string });
});
