import type { MailMessage } from "@/lib/mail/types"

// Re-export MailMessage as the Mail type so all existing consumers keep working
export type Mail = MailMessage

// Static mails array is empty. Data is fetched live from IMAP via useMail() hook
export const mails: Mail[] = []

