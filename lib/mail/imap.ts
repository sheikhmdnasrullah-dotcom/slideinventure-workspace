import 'server-only'
import { ImapFlow, type FetchMessageObject } from 'imapflow'
import type { MailMessage, MailFolder, MailAttachment } from './types'
import { getAccount } from './accounts'

function createClient(email: string): ImapFlow {
  const account = getAccount(email)
  if (!account) throw new Error(`Mail account not configured: ${email}`)

  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: false, // STARTTLS
    auth: {
      user: account.email,
      pass: account.password,
    },
    logger: false,
  })
}

async function withClient<T>(email: string, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = createClient(email)
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.logout()
  }
}

function parseAddress(addr: { name?: string; address?: string } | undefined): { email: string; name: string } {
  if (!addr) return { email: '', name: '' }
  return {
    email: addr.address ?? '',
    name: addr.name ?? addr.address ?? '',
  }
}

function msgToMail(msg: FetchMessageObject, folderPath: string, accountEmail: string): MailMessage {
  const env = msg.envelope!
  const from = parseAddress(env.from?.[0])
  const toList = (env.to ?? []).map((a) => a.address ?? '').filter(Boolean)
  const ccList = (env.cc ?? []).map((a) => a.address ?? '').filter(Boolean)

  const hasAttachments = Boolean(
    msg.bodyStructure?.childNodes?.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n: any) => n.disposition === 'attachment'
    )
  )

  return {
    id: `${msg.uid}|${folderPath}|${accountEmail}`,
    uid: msg.uid,
    folder: folderPath,
    from: from.email,
    fromName: from.name,
    to: toList,
    cc: ccList.length > 0 ? ccList : undefined,
    subject: env.subject ?? '(no subject)',
    text: '',
    date: env.date?.toISOString() ?? new Date().toISOString(),
    read: msg.flags?.has('\\Seen') ?? false,
    labels: [],
    hasAttachments,
    messageId: env.messageId,
  }
}

export async function listFolders(email: string): Promise<MailFolder[]> {
  return withClient(email, async (client) => {
    const list = await client.list()
    const result: MailFolder[] = []
    for (const folder of list) {
      try {
        const status = await client.status(folder.path, { messages: true, unseen: true })
        result.push({
          name: folder.name,
          path: folder.path,
          unread: status.unseen ?? 0,
          total: status.messages ?? 0,
        })
      } catch {
        result.push({ name: folder.name, path: folder.path, unread: 0, total: 0 })
      }
    }
    return result
  })
}

export async function listMessages(
  email: string,
  folderPath: string,
  limit = 50,
  search?: string
): Promise<MailMessage[]> {
  return withClient(email, async (client) => {
    await client.mailboxOpen(folderPath, { readOnly: true })

    let uidRange: number[] | string
    if (search) {
      const found = await client.search({ body: search }, { uid: true })
      if (!found || !Array.isArray(found) || found.length === 0) return []
      uidRange = found.slice(-limit).reverse()
    } else {
      // Fetch most recent `limit` messages
      const status = await client.status(folderPath, { messages: true })
      const count = status.messages ?? 0
      if (count === 0) return []
      const start = Math.max(1, count - limit + 1)
      uidRange = `${start}:${count}`
    }

    const messages: MailMessage[] = []
    for await (const msg of client.fetch(
      uidRange,
      { envelope: true, flags: true, bodyStructure: true, uid: true },
      { uid: typeof uidRange === 'object' }
    )) {
      messages.push(msgToMail(msg, folderPath, email))
    }

    // Return newest first
    return messages.reverse().slice(0, limit)
  })
}

export async function getMessage(
  email: string,
  folderPath: string,
  uid: number
): Promise<MailMessage | null> {
  return withClient(email, async (client) => {
    await client.mailboxOpen(folderPath)

    const msg = await client.fetchOne(
      String(uid),
      { envelope: true, flags: true, bodyStructure: true, source: true, uid: true },
      { uid: true }
    )
    if (!msg) return null

    const base = msgToMail(msg, folderPath, email)

    // Parse attachments
    const attachments: MailAttachment[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (msg.bodyStructure?.childNodes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg.bodyStructure.childNodes.forEach((node: any, idx: number) => {
        if (node.disposition === 'attachment') {
          attachments.push({
            id: `${uid}-${idx + 2}`,
            filename: node.dispositionParameters?.filename
              ?? node.parameters?.name
              ?? `attachment-${idx + 2}`,
            contentType: `${node.type ?? 'application'}/${node.subtype ?? 'octet-stream'}`,
            size: node.size ?? 0,
            part: String(idx + 2),
          })
        }
      })
    }

    // Extract body text from source
    const source = msg.source?.toString('utf-8') ?? ''
    const bodyMatch = source.match(/\r?\n\r?\n([\s\S]*)/)
    const rawBody = bodyMatch ? bodyMatch[1] : ''
    const isHtml = rawBody.trimStart().startsWith('<')

    return {
      ...base,
      text: isHtml ? '' : rawBody,
      html: isHtml ? rawBody : undefined,
      hasAttachments: attachments.length > 0,
      attachments,
      inReplyTo: msg.envelope?.inReplyTo,
    }
  })
}

export async function markRead(email: string, folderPath: string, uid: number, read: boolean): Promise<void> {
  return withClient(email, async (client) => {
    await client.mailboxOpen(folderPath)
    if (read) {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
    } else {
      await client.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true })
    }
  })
}

export async function moveMessage(
  email: string,
  srcFolder: string,
  uid: number,
  destFolder: string
): Promise<void> {
  return withClient(email, async (client) => {
    await client.mailboxOpen(srcFolder)
    await client.messageMove(String(uid), destFolder, { uid: true })
  })
}

export async function deleteMessage(email: string, folderPath: string, uid: number): Promise<void> {
  const trashFolder = 'Trash'
  if (folderPath === trashFolder) {
    // Permanently delete if already in Trash
    return withClient(email, async (client) => {
      await client.mailboxOpen(folderPath)
      await client.messageDelete(String(uid), { uid: true })
    })
  }
  return moveMessage(email, folderPath, uid, trashFolder)
}
