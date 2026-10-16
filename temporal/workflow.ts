import { proxyActivities } from "@temporalio/workflow";
import type * as acts from "./activities";

const { executeViaApi } = proxyActivities<typeof acts>({
  startToCloseTimeout: "10 minutes",
});

export async function runAgentTask(input: unknown): Promise<void> {
  await executeViaApi(input as { task: string; startUrl?: string; userEmail?: string });
}
