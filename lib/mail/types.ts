export interface MailMessage {
  id: string
  uid: number
  folder: string
  from: string
  fromName: string
  to: string[]
  cc?: string[]
  subject: string
  text: string
  html?: string
  date: string
  read: boolean
  labels: string[]
  hasAttachments: boolean
  attachments?: MailAttachment[]
  inReplyTo?: string
  messageId?: string
}

export interface MailAttachment {
  id: string
  filename: string
  contentType: string
  size: number
  part: string
}

export interface MailFolder {
  name: string
  path: string
  unread: number
  total: number
}

export interface SendMailInput {
  to: string | string[]
  subject: string
  body: string
  inReplyTo?: string
  references?: string
  forwardOf?: string
}
