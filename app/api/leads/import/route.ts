import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { leads: leadsToImport } = body as { leads?: Array<Record<string, unknown>> }

    if (!Array.isArray(leadsToImport) || leadsToImport.length === 0) {
      return Response.json({ error: "No leads provided" }, { status: 400 })
    }

    const supabase = createServiceClient()
    const now = new Date().toISOString()

    // Get existing leads by email to detect duplicates
    const emails = leadsToImport
      .map((lead) => lead.email ?? (lead as any).name ?? "")
      .filter((email): email is string => email !== "")

    let existingLeads: Record<string, string> = {} // email -> id mapping
    if (emails.length > 0) {
      const { data: existing, error } = await supabase
        .from("leads")
        .select("id, email")
        .in("email", emails)

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      if (existing) {
        existing.forEach((lead: { id: string; email: string }) => {
          const emailKey = lead.email?.toLowerCase() ?? ""
          if (emailKey) {
            existingLeads[emailKey] = lead.id
          }
        })
      }
    }

    // Process each lead: update if exists, create if new
    const toCreate: Array<Record<string, unknown>> = []
    const toUpdate: Array<Record<string, unknown>> = []

    leadsToImport.forEach((lead) => {
      const email = String(lead.email ?? lead.name ?? "").toLowerCase()
      const row = {
        id: existingLeads[email] || crypto.randomUUID(),
        first_name: String(lead.first_name ?? lead.name ?? ""),
        last_name: String(lead.last_name ?? ""),
        email: lead.email ?? "",
        company: lead.company ? String(lead.company) : null,
        job_title: lead.job_title ? String(lead.job_title) : null,
        phone: lead.phone ? String(lead.phone) : null,
        source: String(lead.source ?? "import"),
        status: String(lead.status ?? "new"),
        notes: lead.notes ? String(lead.notes) : null,
        tags: Array.isArray(lead.tags) ? lead.tags.map(String) : [],
        custom_fields: (lead.custom_fields as Record<string, unknown>) ?? {},
        updated_at: now,
      }

      if (existingLeads[email]) {
        // Update existing lead - keep the same ID
        row.id = existingLeads[email]!
        toUpdate.push(row)
      } else {
        // New lead
        toCreate.push(row)
      }
    })

    // Insert new leads
    if (toCreate.length > 0) {
      const { error: createError } = await supabase.from("leads").insert(toCreate)
      if (createError) {
        return Response.json({ error: createError.message }, { status: 500 })
      }
    }

    // Update existing leads
    if (toUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(toUpdate.map(row => ({
          ...row,
          updated_at: now,
        })))
      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 })
      }
    }

    const imported = toCreate.length + toUpdate.length

    return Response.json({ imported, created: toCreate.length, updated: toUpdate.length }, { status: 201 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
