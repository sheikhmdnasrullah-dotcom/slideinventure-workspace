import "server-only";

// Langfuse: LLM observability/tracing. Optional: active when LANGFUSE_* keys
// are set. Used to trace LLM generations alongside (or instead of) Datadog.
export function langfuseEnabled(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

let client: any | null = null;
async function getClient(): Promise<any | null> {
  if (!langfuseEnabled()) return null;
  if (!client) {
    try {
      const { Langfuse } = await import("langfuse");
      client = new Langfuse({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY as string,
        secretKey: process.env.LANGFUSE_SECRET_KEY as string,
        baseUrl: process.env.LANGFUSE_BASEURL || "https://cloud.langfuse.com",
      });
    } catch {
      client = null;
    }
  }
  return client;
}

export async function langfuseGeneration(opts: {
  name: string;
  model: string;
  input: unknown;
  output?: unknown;
  usage?: { promptTokens?: number; completionTokens?: number };
}): Promise<void> {
  const lf = await getClient();
  if (!lf) return;
  try {
    const gen = lf.generation({
      name: opts.name,
      model: opts.model,
      input: opts.input,
      output: opts.output,
      usage: opts.usage
        ? { input: opts.usage.promptTokens ?? 0, output: opts.usage.completionTokens ?? 0 }
        : undefined,
    });
    await gen?.end?.();
  } catch {
    /* no-op */
  }
}
