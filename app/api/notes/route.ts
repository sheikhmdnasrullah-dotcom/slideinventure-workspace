import { NextRequest } from "next/server";
import { getSessionUser, createServiceClient } from "@/lib/supabase/server";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(new NextRequest("http://x"), { limit: 60, windowMs: 60_000, identifier: `notes-list:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, content, created_at, updated_at")
      .eq("user_email", user.email ?? "")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return Response.json({ notes: (data ?? []).map((n) => ({ ...n, content: JSON.stringify(n.content) })) });
  } catch (error) {
    return toJson(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000, identifier: `notes-create:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const title = (body.title as string | undefined)?.toString().slice(0, 200) || "Untitled note";
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("notes")
      .insert({ title, content: "[]", user_email: user.email ?? "" })
      .select("id, title, content, created_at, updated_at")
      .single();
    if (error) throw error;
    return Response.json({ note: { ...data, content: JSON.stringify(data.content) } }, { status: 201 });
  } catch (error) {
    return toJson(error);
  }
}
