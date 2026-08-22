import 'server-only'
import nodemailer from 'nodemailer'
import type { SendMailInput } from './types'
import { getAccount } from './accounts'

function createTransport(email: string) {
  const account = getAccount(email)
  if (!account) throw new Error(`Mail account not configured: ${email}`)

  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: false, // STARTTLS
    auth: {
      user: account.email,
      pass: account.password,
    },
    tls: {
      rejectUnauthorized: false, // Self-hosted mail server may use self-signed cert
    },
  })
}

export async function sendMail(email: string, input: SendMailInput): Promise<{ messageId: string }> {
  const transport = createTransport(email)
  const account = getAccount(email)
  const from = `${account?.name ?? 'User'} <${email}>`

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
