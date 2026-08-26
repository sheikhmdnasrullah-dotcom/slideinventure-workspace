import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, storage, ID, Permission, Role } from "@/lib/appwrite/server";
import { InputFile } from "node-appwrite/file";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";
import { extractFileText } from "@/lib/knowledge/file-extract";
import { linkDocumentToKnowledge } from "@/lib/knowledge/link-document";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.documents;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim() || "Untitled";
    const tags = ((formData.get("tags") as string | null) || "").split(",").map((t) => t.trim()).filter(Boolean);
    const author = user.email || "user";

    if (!file) {
      return ApiError.badRequest("FILE_REQUIRED", "File is required").toResponse();
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return ApiError.badRequest("FILE_TOO_LARGE", "File exceeds 50MB limit").toResponse();
    }

    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"];
    if (file.type && !allowedTypes.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".docx") && !file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      return ApiError.badRequest("UNSUPPORTED_TYPE", "Unsupported file type").toResponse();
    }

    const id = ID.unique();
    const bytes = await file.arrayBuffer();

    const fileId = id;
    await storage.createFile(
      "files",
      fileId,
      InputFile.fromBuffer(Buffer.from(bytes), file.name),
      [Permission.read(Role.any())]
    );

    const url = `${APPWRITE.endpoint}/storage/buckets/files/files/${fileId}/view?project=${APPWRITE.projectId}`;

    try {
      await databases.createDocument(DB, COL, id, {
        title,
        filename: file.name,
        mime_type: file.type || "application/pdf",
        size_bytes: file.size,
        storage_path: fileId,
        url,
        tags,
        status: "active",
        author,
        source: "dashboard",
        workspace: "documents",
        node_type: "file",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (dbError) {
      try {
        await storage.deleteFile("files", fileId);
      } catch {
        // best-effort cleanup
      }
      throw dbError;
    }

    // Best-effort: mirror this document into Knowledge so it's searchable
    // and cross-referenced. Never blocks or fails the upload itself.
    try {
      const extracted = await extractFileText(file);
      if (extracted.text) {
        await linkDocumentToKnowledge({
          documentId: id,
          title,
          text: extracted.text,
          source: "documents",
          author,
        });
      }
    } catch (err) {
      console.warn("Knowledge indexing skipped for document", id, err);
    }

    return Response.json({ id, url, title, filename: file.name }, { status: 201 });
  } catch (error) {
    return ApiError.internal("UPLOAD_ERROR", error instanceof Error ? error.message : "Upload failed").toResponse();
  }
}
