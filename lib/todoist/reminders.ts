import 'server-only'

import { createServiceClient } from '@/lib/supabase/server'
import { sendMail } from '@/lib/mail/smtp'
import { getDefaultAccount } from '@/lib/mail/accounts'

export interface TaskReminder {
  id: string
  externalId?: string
  content: string
  dueDate?: string
  completed: boolean
  assignee?: string
  reminderSentAt?: string
}

const REMINDER_LEAD_MINUTES = 60
const REMINDER_EMAIL = 'nasrullahtanim@gmail.com'

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

    const supabase = createServiceClient()
    await supabase
      .from('todoist_tasks')
      .update({ metadata: { ...task.metadata, reminder_sent_at: new Date().toISOString() } })
      .eq('external_id', task.externalId ?? task.id)

    return true
  } catch (error) {
    console.error('Failed to send task reminder:', error)
    return false
  }
}

export async function checkUpcomingDeadlines(): Promise<{ sent: number; failed: number }> {
  const supabase = createServiceClient()

  const { data: tasks, error } = await supabase
    .from('todoist_tasks')
    .select('*')
    .eq('completed', false)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })

  if (error || !tasks) {
    console.error('Failed to fetch tasks for reminders:', error)
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0

  for (const task of tasks) {
    const metadata = (task.metadata as Record<string, unknown>) ?? {}
    const reminderSentAt = metadata.reminder_sent_at as string | undefined

    if (reminderSentAt && !isOverdue(task.due_date)) {
      continue
    }

    const shouldRemind = isDueSoon(task.due_date) || isOverdue(task.due_date)
    if (!shouldRemind) continue

    const ok = await sendTaskReminder({
      id: task.id,
      externalId: task.external_id ?? undefined,
      content: task.content,
      dueDate: task.due_date ?? undefined,
      completed: task.completed,
      assignee: task.assignee ?? undefined,
      reminderSentAt,
    })

    if (ok) { sent++ } else { failed++ }
  }

  return { sent, failed }
}
