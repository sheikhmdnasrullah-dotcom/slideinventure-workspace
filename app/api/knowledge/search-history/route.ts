import { createServiceClient, getSessionUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("knowledge_search_history")
    .select("id, query, mode, result_count, created_at")
    .eq("user_email", user.email)
    .order("created_at", { ascending: false })
    .limit(20);

  return Response.json(data ?? []);
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  let query = supabase.from("knowledge_search_history").delete().eq("user_email", user.email);
  if (id) query = query.eq("id", id);

  const { error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ status: "deleted" });
}
