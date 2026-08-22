import 'server-only'
import nodemailer from 'nodemailer'
import type { SendMailInput } from './types'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.MAIL_SMTP_HOST ?? 'mail.nasrullahtanim.me',
    port: Number(process.env.MAIL_SMTP_PORT ?? 587),
    secure: false, // STARTTLS
    auth: {
      user: process.env.MAIL_USER ?? '',
      pass: process.env.MAIL_PASSWORD ?? '',
    },
    tls: {
      rejectUnauthorized: false, // Self-hosted mail server may use self-signed cert
    },
  })
}

export async function sendMail(input: SendMailInput): Promise<{ messageId: string }> {
  const transport = createTransport()
  const from = `${process.env.MAIL_FROM_NAME ?? 'Nasrullah'} <${process.env.MAIL_USER}>`

  const info = await transport.sendMail({
    from,
    to: Array.isArray(input.to) ? input.to.join(', ') : input.to,
    subject: input.subject,
    text: input.body,
    ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
    ...(input.references ? { references: input.references } : {}),
  })

  return { messageId: info.messageId }
}
