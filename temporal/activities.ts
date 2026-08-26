// Activity executed inside the Temporal worker. It delegates actual work back
// to the running app via the internal task API (see app/api/internal/run-task).
// Keeping execution in the app (not the worker) avoids duplicating the
// Playwright/browse/LLM runtime inside the worker process.
export async function executeViaApi(input: {
  task: string;
  startUrl?: string;
  userEmail?: string;
}): Promise<unknown> {
  const base = process.env.APP_INTERNAL_URL || "http://localhost:3000";
  const token = process.env.INTERNAL_API_TOKEN || "";
  const res = await fetch(`${base}/api/internal/run-task`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-token": token,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`internal run-task failed: ${res.status}`);
  }
  return res.json();
}
