import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id } = body as { id?: string };

    if (!id) {
      return Response.json({ error: "Lead id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("leads").delete().eq("id", id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
