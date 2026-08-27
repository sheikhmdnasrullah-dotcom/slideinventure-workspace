import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest } from "next/server";
import { modelFor, primaryProvider } from "@/lib/llm/models";

/**
 * CopilotKit runtime.
 *
 * Uses the same resolved provider as every other AI route (lib/llm/models), so
 * the copilot can never end up on a different model than the chat. Built lazily
 * on first request rather than at module scope: env is loaded through Infisical
 * at first LLM use, and a missing key should return a clear error instead of
 * breaking the module import for the whole app.
 */

let cached: { runtime: CopilotRuntime; adapter: OpenAIAdapter } | null = null;

function getRuntime() {
  if (cached) return cached;
  const provider = primaryProvider();
  if (!provider) return null;

  const openai = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL });
  cached = {
    runtime: new CopilotRuntime(),
    adapter: new OpenAIAdapter({ openai, model: modelFor(provider) }),
  };
  return cached;
}

export const POST = async (req: NextRequest) => {
  const resolved = getRuntime();
  if (!resolved) {
    return Response.json(
      {
        error:
          "No AI provider configured. Set DEEPSEEK_API_KEY, NVIDIA_API_KEY, OPENROUTER_API_KEY, or LiteLLM credentials.",
      },
      { status: 503 }
    );
  }

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    endpoint: "/api/copilot",
    runtime: resolved.runtime,
    serviceAdapter: resolved.adapter,
  });
  return handleRequest(req);
};

export const GET = POST;
