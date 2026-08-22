import { createServiceClient, requireUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextRequest } from "next/server";
import { recordAudit } from "@/lib/api/audit";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim() || "Untitled";
    const tags = ((formData.get("tags") as string | null) || "").split(",").map((t) => t.trim()).filter(Boolean);
    const author = user.email || "user";

    if (!file) {
      return toJson(ApiError.badRequest("FILE_REQUIRED", "File is required"));
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return toJson(ApiError.badRequest("FILE_TOO_LARGE", "File exceeds 50MB limit"));
    }

    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"];
    if (file.type && !allowedTypes.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".docx") && !file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      return toJson(ApiError.badRequest("UNSUPPORTED_TYPE", "Unsupported file type"));
    }

    const id = randomUUID();
    const ext = path.extname(file.name) || ".pdf";
    const storageFilename = `${id}${ext}`;

    const supabase = createServiceClient();

    const bytes = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storageFilename, bytes, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return toJson(ApiError.internal("STORAGE_ERROR", "Failed to upload file to storage"));
    }

    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(storageFilename);

    const { error: dbError } = await supabase.from("documents").insert({
      id,
      title,
      filename: file.name,
      mime_type: file.type || "application/pdf",
      size_bytes: file.size,
      storage_path: storageFilename,
      url: publicUrl,
      tags,
      author,
      status: "active",
    });

    if (dbError) {
      await supabase.storage.from("documents").remove([storageFilename]);
      return toJson(ApiError.internal("DB_ERROR", "Failed to save metadata"));
    }

    return Response.json({ id, url: publicUrl, title, filename: file.name }, { status: 201 });
  } catch (error) {
    return toJson(ApiError.internal("UPLOAD_ERROR", error instanceof Error ? error.message : "Upload failed"));
  }
}
