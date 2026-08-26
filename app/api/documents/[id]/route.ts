import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, storage } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { NextRequest } from "next/server";
import { unlinkDocumentFromKnowledge } from "@/lib/knowledge/link-document";
import { deleteVector } from "@/lib/retrieval/vector-index";

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
    if (!doc) return ApiError.notFound("DOCUMENT_NOT_FOUND", "Document not found").toResponse();

    if (doc.author && user.email && doc.author !== user.email) {
      return ApiError.forbidden("NOT_OWNER", "You can only delete documents you uploaded").toResponse();
    }

    const storagePath = doc?.storage_path as string | undefined;

    // Delete the binary first. If it fails for a reason other than "already
    // gone", abort so we never leave an orphaned file behind.
    if (storagePath) {
      try {
        await storage.deleteFile("files", storagePath);
      } catch (storageError) {
        const code = (storageError as { code?: number })?.code;
        if (code !== 404) throw storageError;
      }
    }

    // This is a permanent delete of the canonical file, so its Knowledge
    // mirror (an index entry, not an independent copy) goes with it.
    await unlinkDocumentFromKnowledge(doc?.knowledge_item_id);

    await databases.deleteDocument(DB, COL, id);
    deleteVector({ collection: "documents", docId: id }).catch(() => {});

    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return toJson(error);
  }
}
