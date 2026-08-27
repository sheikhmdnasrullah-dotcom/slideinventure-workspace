import "server-only";

// Novu: notification delivery (in-app / email / push). Used alongside the
// existing Appwrite notifications. Optional: active only when NOVU_SECRET_KEY
// is set; otherwise notifyViaNovu is a no-op.
export function novuEnabled(): boolean {
  return Boolean(process.env.NOVU_SECRET_KEY);
}

export async function notifyViaNovu(opts: {
  subscriberId: string;
  email?: string;
  title: string;
  body: string;
}): Promise<void> {
  if (!novuEnabled()) return;
  try {
    const { Novu } = await import("@novu/api");
    const novu = new Novu({ secretKey: process.env.NOVU_SECRET_KEY as string });
    await (novu as any).trigger?.({
      workflowId: process.env.NOVU_WORKFLOW_ID || "workspace-notification",
      to: { subscriberId: opts.subscriberId, email: opts.email },
      payload: { title: opts.title, body: opts.body },
    });
  } catch {
    // best-effort; never break the primary notification path
  }
}
