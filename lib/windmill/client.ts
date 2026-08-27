import "server-only";

// Windmill. Self-hosted workflow/automation engine. Optional orchestration
// layer. No official JS client on npm, so we use the REST API. Active only when
// WINDMILL_API_URL + WINDMILL_TOKEN are set.
export function windmillEnabled(): boolean {
  return Boolean(process.env.WINDMILL_API_URL && process.env.WINDMILL_TOKEN);
}

export async function runWindmillJob(opts: {
  workspace: string;
  path: string;
  args?: Record<string, unknown>;
}): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  if (!windmillEnabled()) return { ok: false, error: "Windmill not configured" };
  try {
    const url = `${process.env.WINDMILL_API_URL}/api/w/${opts.workspace}/jobs/run_wait_result`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WINDMILL_TOKEN}`,
      },
      body: JSON.stringify({
        path: opts.path,
        args: opts.args ?? {},
        scheduled_for: null,
        run_async: false,
      }),
    });
    if (!res.ok) return { ok: false, error: `Windmill ${res.status}` };
    return { ok: true, result: await res.json() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Windmill failed" };
  }
}
