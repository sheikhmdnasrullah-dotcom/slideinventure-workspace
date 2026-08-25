import { NextRequest } from "next/server";
import { getSessionUser, createServiceClient } from "@/lib/supabase/server";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, content, created_at, updated_at")
      .eq("id", id)
      .eq("user_email", user.email ?? "")
      .single();
    if (error) throw error;
    if (!data) return ApiError.notFound().toResponse();
    return Response.json({ note: { ...data, content: JSON.stringify(data.content) } });
  } catch (error) {
    return toJson(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `notes-update:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const title = (body.title as string | undefined)?.toString().slice(0, 200);
    const content = body.content; // already a JSON string from the editor
    const supabase = createServiceClient();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof title === "string") update.title = title;
    if (typeof content === "string") update.content = content;

    const { data, error } = await supabase
      .from("notes")
      .update(update)
      .eq("id", id)
      .eq("user_email", user.email ?? "")
      .select("id, title, content, created_at, updated_at")
      .single();
    if (error) throw error;
    if (!data) return ApiError.notFound().toResponse();
    return Response.json({ note: { ...data, content: JSON.stringify(data.content) } });
  } catch (error) {
    return toJson(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_email", user.email ?? "");
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return toJson(error);
  }
}
