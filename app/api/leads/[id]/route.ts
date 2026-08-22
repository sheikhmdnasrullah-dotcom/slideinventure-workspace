import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? null);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json().catch(() => ({}));

    const {
      first_name,
      last_name,
      email,
      company,
      job_title,
      phone,
      source,
      status,
      notes,
      tags,
      custom_fields = {},
    } = body as {
      first_name?: string;
      last_name?: string;
      email?: string;
      company?: string;
      job_title?: string;
      phone?: string;
      source?: string;
      status?: string;
      notes?: string;
      tags?: string[];
      custom_fields?: Record<string, unknown>;
    };

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("leads")
      .update({
        first_name,
        last_name,
        email,
        company: company ?? null,
        job_title: job_title ?? null,
        phone: phone ?? null,
        source,
        status,
        notes: notes ?? null,
        tags,
        custom_fields: custom_fields ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id, status: "updated" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: pathId } = await params
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
