import { createServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { unlink } from "node:fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "documents");

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Document id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: existing, error: fetchError } = await supabase
      .from("documents")
      .select("storage_path, filename")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    if (!existing) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }

    try {
      await unlink(existing.storage_path);
    } catch {
      // ignore file-system cleanup errors
    }

    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
