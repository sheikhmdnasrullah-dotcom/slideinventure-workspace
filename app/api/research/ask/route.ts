import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/appwrite/auth"
import { ApiError } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { nvidiaComplete } from "@/lib/llm/nvidia"

// Reuses the same NVIDIA-backed LLM that already powers Chat — no new
// provider, no new API key. `context` is a short plain-text snapshot of
// what's already on the research canvas (the caller extracts it from the
// canvas elements), so the answer can build on what's already there.
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000, identifier: `research-ask:${user.id}` })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const body = await request.json().catch(() => ({}))
  const { question, context } = body as { question?: string; context?: string }
  if (!question?.trim()) {
    return ApiError.badRequest("MISSING_QUESTION", "question is required").toResponse()
  }

  try {
    const messages = [
      {
        role: "system",
        content:
          "You are a research assistant embedded in a freeform research canvas. Answer directly and concisely — a few sentences or a short list, not an essay. If context from the canvas is given, use it.",
      },
      ...(context?.trim()
        ? [{ role: "user", content: `Context already on the canvas:\n${context.slice(0, 4000)}` }]
        : []),
      { role: "user", content: question },
    ]
    const answer = await nvidiaComplete(messages, { maxTokens: 600 })
    return Response.json({ answer })
  } catch (error) {
    return ApiError.internal("AI_ERROR", error instanceof Error ? error.message : "AI request failed").toResponse()
  }
}
