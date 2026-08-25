import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, storage } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.documents;

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
