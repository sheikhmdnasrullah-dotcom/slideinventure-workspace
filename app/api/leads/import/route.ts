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

  // A full name landed in first_name with no last_name: split it.
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

    const emails = [
      ...new Set(
        leadsToImport
          .map((lead) => String(lead.email ?? lead.name ?? lead.full_name ?? ""))
          .filter((email): email is string => email !== "")
      ),
    ]

    // Appwrite rejects a Query.equal array value over 100 entries AND the
    // serialized query string over 4096 chars. A CSV with more than ~100
    // distinct emails (exactly the "100+ leads" case this importer needs to
    // handle) made every import fail outright, and with real-length emails
    // even 100-per-batch can blow the 4096-char cap. Batch by both.
    const EMAIL_QUERY_MAX_ITEMS = 100
    const EMAIL_QUERY_MAX_CHARS = 3500 // margin under Appwrite's 4096 cap for JSON/query overhead
    const emailBatches: string[][] = []
    let current: string[] = []
    let currentChars = 0
    for (const email of emails) {
      const cost = email.length + 3 // quotes + comma
      if (current.length >= EMAIL_QUERY_MAX_ITEMS || (current.length > 0 && currentChars + cost > EMAIL_QUERY_MAX_CHARS)) {
        emailBatches.push(current)
        current = []
        currentChars = 0
      }
      current.push(email)
      currentChars += cost
    }
    if (current.length > 0) emailBatches.push(current)

    const existingLeads: Record<string, string> = {} // email -> $id mapping
    for (const batch of emailBatches) {
      const res = await databases.listDocuments(DB, COL, [
        Query.equal("email", batch),
        Query.limit(EMAIL_QUERY_MAX_ITEMS),
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
    // Tracks emails not yet in the DB but already queued in this batch.
    // Without this, two rows sharing an email (a real "verify duplicate
    // handling" case, not just re-imports of an existing lead) both looked
    // up against the same pre-import snapshot and both created, producing
    // two leads with the same email instead of the second updating the
    // first.
    const pendingCreateIndexByEmail: Record<string, number> = {}
    const updateIndexByEmail: Record<string, number> = {}

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
        // A later row for the same already-existing lead overwrites the
        // earlier queued update rather than issuing two updateDocument
        // calls (the last row in the CSV wins, matching "last value wins"
        // for any other in-batch duplicate).
        if (email && email in updateIndexByEmail) {
          toUpdate[updateIndexByEmail[email]] = { id: existingId, row }
        } else {
          if (email) updateIndexByEmail[email] = toUpdate.length
          toUpdate.push({ id: existingId, row })
        }
      } else if (email && email in pendingCreateIndexByEmail) {
        toCreate[pendingCreateIndexByEmail[email]] = { ...row, created_at: now }
      } else {
        row.created_at = now
        if (email) pendingCreateIndexByEmail[email] = toCreate.length
        toCreate.push(row)
      }
    }

    // A 121-row import took 114s running one createDocument/updateDocument
    // call at a time in sequence, well past what a Vercel serverless
    // function is given, so any realistically-sized ("100+ leads") import
    // would time out and fail outright in production. Run a bounded number
    // of writes in flight at once instead of fully serializing them.
    const WRITE_CONCURRENCY = 10
    async function runPooled<T>(items: T[], worker: (item: T) => Promise<void>) {
      let cursor = 0
      async function next(): Promise<void> {
        const i = cursor++
        if (i >= items.length) return
        await worker(items[i])
        return next()
      }
      await Promise.all(Array.from({ length: Math.min(WRITE_CONCURRENCY, items.length) }, next))
    }

    await runPooled(toCreate, (row) => databases.createDocument(DB, COL, ID.unique(), row).then(() => {}))
    await runPooled(toUpdate, ({ id, row }) => databases.updateDocument(DB, COL, id, row).then(() => {}))

    const imported = toCreate.length + toUpdate.length
    logActivity({
      category: "leads",
      action: "imported",
      title: `Lead import completed`,
      description: `${imported} leads imported (${toCreate.length} new, ${toUpdate.length} updated)`,
      entityType: "leads",
      notify: true,
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
