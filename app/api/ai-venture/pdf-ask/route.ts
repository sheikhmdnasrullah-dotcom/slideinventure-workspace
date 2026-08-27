import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/appwrite/auth"
import { databases, storage } from "@/lib/appwrite/server"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { extractFileText } from "@/lib/knowledge/file-extract"
import { nvidiaComplete } from "@/lib/llm/nvidia"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.documents

// Reuses the same NVIDIA-backed LLM as Chat/Research Lab and the same
// pdf-parse extraction Knowledge uses for PDF imports — no new AI provider,
// no OCR. If pdf-parse can't pull text (an image-only scan, for example)
// this says so plainly instead of pretending to have read it.
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 15, windowMs: 60_000, identifier: `ai-venture-pdf-ask:${user.id}` })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const body = await request.json().catch(() => ({}))
  const { documentId, question } = body as { documentId?: string; question?: string }
  if (!documentId || !question?.trim()) {
    return ApiError.badRequest("MISSING_FIELDS", "documentId and question are required").toResponse()
  }

  try {
    const doc = await databases.getDocument(DB, COL, documentId)
    if ((doc.workspace as string | undefined) !== "ai-venture") {
      return ApiError.notFound("NOT_FOUND", "PDF not found").toResponse()
    }
    const storagePath = doc.storage_path as string | undefined
    if (!storagePath) return ApiError.badRequest("NO_FILE", "This PDF has no stored content").toResponse()

    const buf = await storage.getFileDownload("files", storagePath)
    const filename = (doc.filename as string) || "document.pdf"
    const file = new File([new Uint8Array(buf)], filename, { type: "application/pdf" })
    const extracted = await extractFileText(file)

    if (!extracted.text || extracted.text.startsWith("[Uploaded PDF:")) {
      return Response.json({
        answer:
          "I couldn't extract readable text from this PDF. It may be a scanned/image-only document, which this app doesn't run OCR on.",
      })
    }

    const messages = [
      {
        role: "system",
        content:
          "You are a research assistant answering questions about one uploaded PDF. Answer directly and concisely using only the document text given. If the answer isn't in the text, say so.",
      },
      { role: "user", content: `Document "${filename}":\n\n${extracted.text.slice(0, 12000)}` },
      { role: "user", content: question },
    ]
    const answer = await nvidiaComplete(messages, { maxTokens: 700 })
    return Response.json({ answer })
  } catch (error) {
    return ApiError.internal("AI_ERROR", error instanceof Error ? error.message : "AI request failed").toResponse()
  }
}
