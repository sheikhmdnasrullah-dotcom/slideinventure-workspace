import { NextRequest } from "next/server";
import { generateText } from "ai";
import { resolveChatModel } from "@/lib/llm/models";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";

const SYSTEM = `You are a workflow planner for an autonomous agent.
Given a user request, return an ordered list of steps to execute it.
Each step kind is one of:
- "research": browse the web with a headless browser to gather facts/links
- "reason": think through the problem using the LLM
- "output": produce the final deliverable/answer
- "tool": invoke a specialist tool for the task
Return ONLY minified JSON, no markdown, in this shape:
{"steps":[{"kind":"research|reason|output|tool","label":"short title","instruction":"what this step should accomplish"}]}
Use 2-5 steps. The first step is usually research, the last is usually output.`;

function extractJson(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const body = await request.json().catch(() => null);
  const prompt = (body?.prompt as string) || "";
  if (!prompt.trim()) {
    return ApiError.badRequest("MISSING_PROMPT", "prompt is required").toResponse();
  }

  try {
    const { text } = await generateText({
      model: resolveChatModel(),
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    });
    const parsed = extractJson(text);
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    return Response.json({ steps: steps.slice(0, 6) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "plan failed";
    return Response.json({ error: message, steps: [] }, { status: 500 });
  }
}
