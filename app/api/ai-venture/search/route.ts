import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError, toJson } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"

const DB = APPWRITE.databaseId

export type AIVentureSearchHit = {
  type: "sketch" | "idea" | "pdf" | "research"
  id: string
  title: string
  snippet: string
  updatedAt: string
}

// Personal-scale data (one user's AI Venture workspace) — a bounded fetch
// per collection plus an in-memory substring filter is simpler and more
// reliable than requiring fulltext indexes on every searched column, and
// avoids sending anything to the LLM for a plain search.
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `ai-venture-search:${user.id}` })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase()
  if (!q) return Response.json({ results: [] })

  const email = user.email ?? ""

  try {
    const [boards, notes, docs, research] = await Promise.all([
      databases.listDocuments(DB, APPWRITE.collections.boards, [
        Query.equal("user_email", email),
        Query.equal("scope", "ai-venture"),
        Query.limit(500),
      ]),
      databases.listDocuments(DB, APPWRITE.collections.notes, [
        Query.equal("user_email", email),
        Query.equal("scope", "ai-venture"),
        Query.limit(500),
      ]),
      databases.listDocuments(DB, APPWRITE.collections.documents, [
        Query.equal("workspace", "ai-venture"),
        Query.equal("node_type", "file"),
        Query.limit(500),
      ]),
      databases.listDocuments(DB, APPWRITE.collections.researchWorkspaces, [
        Query.equal("user_email", email),
        Query.equal("scope", "ai-venture"),
        Query.limit(500),
      ]),
    ])

    const results: AIVentureSearchHit[] = []

    for (const b of boards.documents) {
      const title = (b.title as string) || "Untitled sketch"
      if (title.toLowerCase().includes(q)) {
        results.push({ type: "sketch", id: b.$id, title, snippet: "Brainstorm sketch", updatedAt: b.updated_at })
      }
    }

    for (const n of notes.documents) {
      const title = (n.title as string) || "Untitled idea"
      const content = (n.content as string) || ""
      const plain = plainTextFromBlockNote(content)
      if (title.toLowerCase().includes(q) || plain.toLowerCase().includes(q)) {
        results.push({
          type: "idea",
          id: n.$id,
          title,
          snippet: snippetAround(plain, q),
          updatedAt: n.updated_at,
        })
      }
    }

    for (const d of docs.documents) {
      const title = (d.title as string) || (d.filename as string) || "Untitled file"
      if (title.toLowerCase().includes(q)) {
        results.push({ type: "pdf", id: d.$id, title, snippet: d.folder_path || "", updatedAt: d.updated_at })
      }
    }

    for (const r of research.documents) {
      const title = (r.title as string) || "Untitled research"
      if (title.toLowerCase().includes(q)) {
        results.push({ type: "research", id: r.$id, title, snippet: "Research finding", updatedAt: r.updated_at })
      }
    }

    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return Response.json({ results: results.slice(0, 50) })
  } catch (error) {
    return toJson(error)
  }
}

function plainTextFromBlockNote(json: string): string {
  try {
    const blocks = JSON.parse(json)
    const out: string[] = []
    const walk = (nodes: unknown) => {
      if (!Array.isArray(nodes)) return
      for (const node of nodes) {
        if (node && typeof node === "object") {
          const n = node as Record<string, unknown>
          if (typeof n.text === "string") out.push(n.text)
          if (Array.isArray(n.content)) walk(n.content)
          if (Array.isArray(n.children)) walk(n.children)
        }
      }
    }
    walk(blocks)
    return out.join(" ")
  } catch {
    return ""
  }
}

function snippetAround(text: string, q: string): string {
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return text.slice(0, 120)
  const start = Math.max(0, idx - 40)
  return `${start > 0 ? "…" : ""}${text.slice(start, idx + q.length + 60)}`
}
