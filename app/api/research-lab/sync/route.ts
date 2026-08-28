import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { captureResearchInsight, listResearchLabItems } from "@/lib/research-lab/capture";
import { blockNoteToPlainText } from "@/lib/retrieval/blocknote-text";
import { summarizeExcalidrawScene } from "@/lib/research-lab/excalidraw-summary";
import { readFileContent } from "@/lib/ai-venture/fs";

const DB = APPWRITE.databaseId;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.email) return ApiError.unauthorized().toResponse();

  try {
    const existingResearch = await listResearchLabItems(user.email);
    const existingMap = new Map(existingResearch.map((r) => [`${r.source}:${r.sourceRef}`, r]));

    let syncedCount = 0;

    // 1. Sync AI Venture Notes
    try {
      const notesRes = await databases.listDocuments(DB, APPWRITE.collections.notes, [
        Query.equal("user_email", user.email),
        Query.equal("scope", "ai-venture"),
        Query.orderDesc("updated_at"),
        Query.limit(50),
      ]);

      for (const doc of notesRes.documents) {
        const key = `notepad:${doc.$id}`;
        const existing = existingMap.get(key);
        const docUpdated = new Date((doc.updated_at as string) || (doc.$createdAt as string) || 0).getTime();
        const existingUpdated = existing ? new Date(existing.updatedAt).getTime() : 0;

        if (!existing || docUpdated > existingUpdated + 10_000) {
          const rawText = blockNoteToPlainText((doc.content as string) || "");
          if (rawText.trim().length >= 10) {
            await captureResearchInsight({
              userEmail: user.email,
              source: "notepad",
              sourceRef: doc.$id,
              title: (doc.title as string) || "Untitled note",
              rawText,
              reference: { tab: "notepad", note: doc.$id },
              force: true,
            });
            syncedCount++;
          }
        }
      }
    } catch (err) {
      console.warn("Sync notes error:", err);
    }

    // 2. Sync AI Venture Brainstorm Boards
    try {
      const boardsRes = await databases.listDocuments(DB, APPWRITE.collections.boards, [
        Query.equal("user_email", user.email),
        Query.equal("scope", "ai-venture"),
        Query.orderDesc("updated_at"),
        Query.limit(50),
      ]);

      for (const doc of boardsRes.documents) {
        const key = `brainstorm:${doc.$id}`;
        const existing = existingMap.get(key);
        const docUpdated = new Date((doc.updated_at as string) || (doc.$createdAt as string) || 0).getTime();
        const existingUpdated = existing ? new Date(existing.updatedAt).getTime() : 0;

        if (!existing || docUpdated > existingUpdated + 10_000) {
          const rawText = summarizeExcalidrawScene((doc.content as string) || "");
          if (rawText && rawText.trim().length >= 10) {
            await captureResearchInsight({
              userEmail: user.email,
              source: "brainstorm",
              sourceRef: doc.$id,
              title: (doc.title as string) || "Untitled sketch",
              rawText,
              reference: { tab: "brainstorm", board: doc.$id, engine: "excalidraw" },
              force: true,
            });
            syncedCount++;
          }
        }
      }
    } catch (err) {
      console.warn("Sync boards error:", err);
    }

    // 3. Sync AI Venture Files (.md, .txt, .csv, .json)
    try {
      const filesRes = await databases.listDocuments(DB, APPWRITE.collections.documents, [
        Query.equal("workspace", "ai-venture"),
        Query.equal("node_type", "file"),
        Query.orderDesc("updated_at"),
        Query.limit(50),
      ]);

      for (const doc of filesRes.documents) {
        const path = (doc.folder_path as string) || (doc.title as string) || "";
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        if (!["md", "txt", "markdown", "csv", "tsv", "json"].includes(ext)) continue;

        const key = `files:${path}`;
        const existing = existingMap.get(key);
        const docUpdated = new Date((doc.updated_at as string) || (doc.$createdAt as string) || 0).getTime();
        const existingUpdated = existing ? new Date(existing.updatedAt).getTime() : 0;

        if (!existing || docUpdated > existingUpdated + 10_000) {
          try {
            const fileData = await readFileContent(path);
            const rawContent = fileData?.content || "";
            if (rawContent && rawContent.trim().length >= 10) {
              await captureResearchInsight({
                userEmail: user.email,
                source: "files",
                sourceRef: path,
                title: (doc.title as string) || path.split("/").pop() || path,
                rawText: rawContent,
                reference: { tab: "files", path },
                force: true,
              });
              syncedCount++;
            }
          } catch {
            // skip binary/unreadable files
          }
        }
      }
    } catch (err) {
      console.warn("Sync files error:", err);
    }

    const updatedItems = await listResearchLabItems(user.email);
    return Response.json({
      ok: true,
      syncedCount,
      totalItems: updatedItems.length,
      items: updatedItems,
    });
  } catch (error) {
    return toJson(error);
  }
}
