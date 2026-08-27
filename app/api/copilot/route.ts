import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest } from "next/server";

const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.OPENROUTER_API_KEY;

let runtime: CopilotRuntime | null = null;
let serviceAdapter: OpenAIAdapter | null = null;

if (apiKey) {
  const openai = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com/v1",
  });

  serviceAdapter = new OpenAIAdapter({
    openai,
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  });

  runtime = new CopilotRuntime();
}

export const POST = async (req: NextRequest) => {
  if (!runtime || !serviceAdapter) {
    return new Response("Missing AI provider API key. Set DEEPSEEK_API_KEY or OPENROUTER_API_KEY in your environment.", { status: 500 });
  }

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    endpoint: "/api/copilot",
    runtime,
    serviceAdapter,
  });
  return handleRequest(req);
};

export const GET = POST;
