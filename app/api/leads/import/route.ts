import { databases } from "@/lib/appwrite/server"
import { ID, Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { logActivity } from "@/lib/activities/client"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.leads

// Leads are stored as first_name/last_name, but CSVs often provide a single
// "Name" or "Full Name" column. Reconcile those into first/last so imported
// names actually show up in the list and exports.
function splitLeadName(lead: Record<string, unknown>): { firstName: string; lastName: string } {
  let firstName = String(lead.first_name ?? "").trim()
  let lastName = String(lead.last_name ?? "").trim()

  const fullName = String(lead.full_name ?? lead.name ?? "").trim()
  if (fullName && (!firstName || !lastName)) {
    const parts = fullName.split(/\s+/)
    if (parts.length === 1) {
      if (!firstName) firstName = parts[0]
    } else {
      if (!firstName) firstName = parts[0]
      if (!lastName) lastName = parts.slice(1).join(" ")
    }
  }

  // A full name landed in first_name with no last_name — split it.
  if (!lastName && firstName.includes(" ")) {
    const parts = firstName.split(/\s+/)
    lastName = parts.slice(1).join(" ")
    firstName = parts[0]
  }

  return { firstName, lastName }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { leads: leadsToImport } = body as { leads?: Array<Record<string, unknown>> }

    if (!Array.isArray(leadsToImport) || leadsToImport.length === 0) {
      return Response.json({ error: "No leads provided" }, { status: 400 })
    }

    const now = new Date().toISOString()

    const emails = leadsToImport
      .map((lead) => String(lead.email ?? lead.name ?? lead.full_name ?? ""))
      .filter((email): email is string => email !== "")

    const existingLeads: Record<string, string> = {} // email -> $id mapping
    if (emails.length > 0) {
      const res = await databases.listDocuments(DB, COL, [
        Query.equal("email", emails),
        Query.limit(1000),
      ])
      for (const doc of res.documents) {
        const emailKey = String(doc.email ?? "").toLowerCase()
        if (emailKey && !(emailKey in existingLeads)) {
          existingLeads[emailKey] = doc.$id
        }
      }
    }

    const toCreate: Array<Record<string, unknown>> = []
    const toUpdate: Array<{ id: string; row: Record<string, unknown> }> = []

    for (const lead of leadsToImport) {
      const email = String(lead.email ?? lead.name ?? lead.full_name ?? "").toLowerCase()
      const { firstName, lastName } = splitLeadName(lead)
      const row: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        email: lead.email ?? "",
        company: lead.company ? String(lead.company) : null,
        job_title: lead.job_title ? String(lead.job_title) : null,
        phone: lead.phone ? String(lead.phone) : null,
        source: String(lead.source ?? "import"),
        status: String(lead.status ?? "new"),
        notes: lead.notes ? String(lead.notes) : null,
        tags: Array.isArray(lead.tags) ? lead.tags.map(String) : [],
        custom_fields: JSON.stringify((lead.custom_fields as Record<string, unknown>) ?? {}),
        last_contacted_at: (lead.last_contacted_at as string) ?? null,
        updated_at: now,
      }

      const existingId = existingLeads[email]
      if (existingId) {
        toUpdate.push({ id: existingId, row })
      } else {
        row.created_at = now
        toCreate.push(row)
      }
    }

    if (toCreate.length > 0) {
      for (const row of toCreate) {
        await databases.createDocument(DB, COL, ID.unique(), row)
      }
    }

    if (toUpdate.length > 0) {
      for (const { id, row } of toUpdate) {
        await databases.updateDocument(DB, COL, id, row)
      }
    }

    const imported = toCreate.length + toUpdate.length
    logActivity({
      category: "leads",
      action: "imported",
      title: `Lead import completed`,
      description: `${imported} leads imported (${toCreate.length} new, ${toUpdate.length} updated)`,
      entityType: "leads",
      metadata: { imported, created: toCreate.length, updated: toUpdate.length },
    }).catch(() => {})

    return Response.json({ imported, created: toCreate.length, updated: toUpdate.length }, { status: 201 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
