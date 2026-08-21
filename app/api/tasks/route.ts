import { createServiceClient, getSessionUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  let data: any[] = [];

  try {
    const result = await supabase
      .from("task_runs")
      .select("id, task_type, status, command, exit_code, started_at, completed_at, triggered_by, knowledge_item_id")
      .order("started_at", { ascending: false })
      .limit(100);
    data = result.data ?? [];
  } catch {
    // Supabase unreachable; return empty list
  }

  return Response.json(data);
}
