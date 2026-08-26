import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, storage } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { NextRequest } from "next/server";
import { unlinkDocumentFromKnowledge } from "@/lib/knowledge/link-document";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.documents;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  try {
    const doc = await databases.getDocument(DB, COL, id);
    return Response.json({
      id: doc.$id,
      title: doc.title,
      filename: doc.filename,
      mime_type: doc.mime_type,
      url: doc.url,
      workspace: doc.workspace ?? "documents",
      folder_path: doc.folder_path ?? null,
    });
  } catch {
    return ApiError.notFound("DOCUMENT_NOT_FOUND", "Document not found").toResponse();
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;

  try {
    const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id)]);
    const doc = res.documents[0];

    if (doc?.storage_path) {
      try {
        await storage.deleteFile("files", doc.storage_path);
      } catch {
        // best-effort cleanup
      }
    }

    // This is a permanent delete of the canonical file, so its Knowledge
    // mirror (an index entry, not an independent copy) goes with it.
    await unlinkDocumentFromKnowledge(doc?.knowledge_item_id);

    try {
      await databases.deleteDocument(DB, COL, id);
    } catch {
      // best-effort cleanup
    }

    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return toJson(error);
  }
}
