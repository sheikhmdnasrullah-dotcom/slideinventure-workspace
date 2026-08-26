export function parseCustomFields(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
  return value as Record<string, unknown>
}

export function serializeLead(doc: Record<string, unknown>) {
  return {
    id: doc.$id as string,
    first_name: doc.first_name as string,
    last_name: doc.last_name as string,
    email: doc.email as string,
    company: (doc.company as string | null) ?? null,
    job_title: (doc.job_title as string | null) ?? null,
    phone: (doc.phone as string | null) ?? null,
    source: doc.source as string,
    status: doc.status as string,
    notes: (doc.notes as string | null) ?? null,
    tags: Array.isArray(doc.tags) ? (doc.tags as string[]) : [],
    last_contacted_at: (doc.last_contacted_at as string | null) ?? null,
    custom_fields: parseCustomFields(doc.custom_fields),
    created_at: doc.created_at as string,
    updated_at: doc.updated_at as string,
  }
}

export type LeadInput = Record<string, unknown>

export function leadInputToRow(d: LeadInput): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (d.first_name !== undefined) row.first_name = d.first_name
  if (d.last_name !== undefined) row.last_name = d.last_name
  if (d.email !== undefined) row.email = d.email || null
  if (d.company !== undefined) row.company = d.company ?? null
  if (d.job_title !== undefined) row.job_title = d.job_title ?? null
  if (d.phone !== undefined) row.phone = d.phone ?? null
  if (d.source !== undefined) row.source = d.source
  if (d.status !== undefined) row.status = d.status
  if (d.notes !== undefined) row.notes = d.notes ?? null
  if (d.tags !== undefined) row.tags = d.tags
  if (d.last_contacted_at !== undefined) row.last_contacted_at = d.last_contacted_at ?? null
  if (d.custom_fields !== undefined) row.custom_fields = JSON.stringify(d.custom_fields ?? {})
  return row
}
