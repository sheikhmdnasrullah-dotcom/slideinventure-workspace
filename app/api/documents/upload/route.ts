import { createServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "documents");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim() || "Untitled";
    const tags = ((formData.get("tags") as string | null) || "").split(",").map((t) => t.trim()).filter(Boolean);
    const author = (formData.get("author") as string | null)?.trim() || "user";

    if (!file) {
      return Response.json({ error: "File is required" }, { status: 400 });
    }

    const id = randomUUID();
    const ext = path.extname(file.name) || ".pdf";
    const filename = `${id}${ext}`;
    const storagePath = path.join(UPLOAD_DIR, filename);
    const url = `/uploads/documents/${filename}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(storagePath, bytes);

    const supabase = createServiceClient();
    const { error } = await supabase.from("documents").insert({
      id,
      title,
      filename: file.name,
      mime_type: file.type || "application/pdf",
      size_bytes: file.size,
      storage_path: storagePath,
      url,
      tags,
      author,
      status: "active",
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id, url, title, filename }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
