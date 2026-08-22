import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, ids } = body as { action?: string; ids?: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: "No ids provided" }, { status: 400 });
    }

    const supabase = createServiceClient();

    if (action === "delete") {
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ deleted: ids.length });
    }

    if (action === "update") {
      const updates = body as Record<string, unknown>;
      const { error } = await supabase
        .from("leads")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ updated: ids.length });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
