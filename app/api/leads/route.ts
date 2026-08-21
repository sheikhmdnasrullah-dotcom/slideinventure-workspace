import { createServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? []);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      first_name,
      last_name,
      email,
      company,
      job_title,
      phone,
      source = "manual",
      status = "new",
      notes,
      tags = [],
    } = body as {
      id?: string;
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
    };

    if (!first_name || !last_name || !email) {
      return Response.json(
        { error: "first_name, last_name, and email are required" },
        { status: 400 }
      );
    }

    const id = (body as { id?: string }).id ?? randomUUID();

    const supabase = createServiceClient();
    const { error } = await supabase.from("leads").upsert({
      id,
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
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id, status: "created" }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
