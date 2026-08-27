import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://api.deepseek.com/v1",
});

const serviceAdapter = new OpenAIAdapter({
  openai,
  model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
});

const runtime = new CopilotRuntime();

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    endpoint: "/api/copilot",
    runtime,
    serviceAdapter,
  });
  return handleRequest(req);
};

export const GET = POST;
