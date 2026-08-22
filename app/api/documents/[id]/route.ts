import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { NextRequest } from "next/server";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", id).single();

  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  if (doc?.storage_path) {
    try {
      await supabase.storage.from("documents").remove([doc.storage_path]);
    } catch {
      // best-effort cleanup
    }
  }

  return Response.json({ id, status: "deleted" });
}
