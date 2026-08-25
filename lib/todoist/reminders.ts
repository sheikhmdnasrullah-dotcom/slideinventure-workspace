import 'server-only'

import { databases } from '@/lib/appwrite/server'
import { Query } from 'node-appwrite'
import { APPWRITE } from '@/lib/appwrite/config'
import { sendMail } from '@/lib/mail/smtp'
import { getDefaultAccount } from '@/lib/mail/accounts'

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.todoistTasks

export interface TaskReminder {
  id: string
  externalId?: string
  content: string
  dueDate?: string
  completed: boolean
  assignee?: string
  reminderSentAt?: string
  metadata?: Record<string, unknown>
}

const REMINDER_LEAD_MINUTES = 60
const REMINDER_EMAIL = 'nasrullahtanim@gmail.com'

function parseJson(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    try { return JSON.parse(v) } catch { return {} }
  }
  return (v as Record<string, unknown>) ?? {}
}

function isDueSoon(dueDate?: string): boolean {
  if (!dueDate) return false
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const diffMinutes = diffMs / (1000 * 60)
  return diffMinutes <= REMINDER_LEAD_MINUTES && diffMinutes > -24 * 60
}

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

function formatReminderSubject(task: TaskReminder): string {
  if (isOverdue(task.dueDate)) {
    return `Overdue: ${task.content}`
  }
  return `Reminder: ${task.content}`
}

function formatReminderBody(task: TaskReminder): string {
  const due = task.dueDate ? new Date(task.dueDate).toLocaleString() : 'No deadline'
  const status = isOverdue(task.dueDate) ? 'OVERDUE' : 'DUE SOON'
  return `${status}

Task: ${task.content}
Due: ${due}
${task.assignee ? `Assignee: ${task.assignee}` : ''}

Open your Todoist dashboard to manage this task.
`
}

export async function sendTaskReminder(task: TaskReminder): Promise<boolean> {
  try {
    const account = await getDefaultAccount()
    if (!account) {
      console.warn('No mail account configured for task reminders')
      return false
    }

    await sendMail(account.email, {
      to: REMINDER_EMAIL,
      subject: formatReminderSubject(task),
      body: formatReminderBody(task),
    })

    const externalId = task.externalId ?? task.id
    const res = await databases.listDocuments(DB, COL, [Query.equal('external_id', externalId)])

    for (const doc of res.documents) {
      const meta = parseJson(doc.metadata)
      await databases.updateDocument(DB, COL, doc.$id, {
        metadata: JSON.stringify({ ...meta, reminder_sent_at: new Date().toISOString() }),
      })
    }

    return true
  } catch (error) {
    console.error('Failed to send task reminder:', error)
    return false
  }
}

export async function checkUpcomingDeadlines(): Promise<{ sent: number; failed: number }> {
  try {
    const res = await databases.listDocuments(DB, COL, [Query.equal('completed', false), Query.limit(5000)])
    const tasks = res.documents
      .filter((d) => d.due_date != null)
      .map((d) => ({
        id: d.$id,
        externalId: d.external_id ?? undefined,
        content: d.content,
        dueDate: d.due_date ?? undefined,
        completed: d.completed,
        assignee: d.assignee ?? undefined,
        reminderSentAt: (parseJson(d.metadata).reminder_sent_at as string | undefined) ?? undefined,
        metadata: parseJson(d.metadata),
      }))

    let sent = 0
    let failed = 0

    for (const task of tasks) {
      const reminderSentAt = task.reminderSentAt

      if (reminderSentAt && !isOverdue(task.dueDate)) {
        continue
      }

      const shouldRemind = isDueSoon(task.dueDate) || isOverdue(task.dueDate)
      if (!shouldRemind) continue

      const ok = await sendTaskReminder({
        id: task.id,
        externalId: task.externalId,
        content: task.content,
        dueDate: task.dueDate,
        completed: task.completed,
        assignee: task.assignee,
        reminderSentAt,
      })

      if (ok) { sent++ } else { failed++ }
    }

    return { sent, failed }
  } catch (error) {
    console.error('Failed to fetch tasks for reminders:', error)
    return { sent: 0, failed: 0 }
  }
}
