import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { leads: leadsToImport } = body as { leads?: Array<Record<string, unknown>> };

    if (!Array.isArray(leadsToImport) || leadsToImport.length === 0) {
      return Response.json({ error: "No leads provided" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    const rows = leadsToImport.map((lead) => ({
      id: (lead.id as string) || crypto.randomUUID(),
      first_name: String(lead.first_name ?? lead.name ?? ""),
      last_name: String(lead.last_name ?? ""),
      email: String(lead.email ?? ""),
      company: lead.company ? String(lead.company) : null,
      job_title: lead.job_title ? String(lead.job_title) : null,
      phone: lead.phone ? String(lead.phone) : null,
      source: String(lead.source ?? "import"),
      status: String(lead.status ?? "new"),
      notes: lead.notes ? String(lead.notes) : null,
      tags: Array.isArray(lead.tags) ? lead.tags.map(String) : [],
      custom_fields: (lead.custom_fields as Record<string, unknown>) ?? {},
      updated_at: now,
      created_at: lead.created_at ? String(lead.created_at) : now,
    }));

    const { error } = await supabase.from("leads").insert(rows);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ imported: rows.length }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
