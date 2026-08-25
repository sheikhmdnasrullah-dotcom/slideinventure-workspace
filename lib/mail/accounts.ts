import 'server-only'
import { databases, ID } from '@/lib/appwrite/server'
import { Query } from 'node-appwrite'
import { APPWRITE } from '@/lib/appwrite/config'
import { encryptSecret, decryptSecret } from '@/lib/vault/crypto'

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.mailAccounts

export interface MailAccount {
  id?: string // present only for DB-backed accounts (addable/removable)
  email: string
  name: string
  provider: 'imap_smtp' | 'google' | 'microsoft'
  password: string
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
}

// Loads all configured accounts from env vars.
// Pattern: MAIL_ACCOUNT_{n}_EMAIL / _NAME / _PASSWORD
// Falls back to legacy MAIL_USER / MAIL_PASSWORD if no indexed accounts defined.
function loadAccounts(): MailAccount[] {
  const host = process.env.MAIL_IMAP_HOST ?? 'mail.nasrullahtanim.me'
  const imapPort = Number(process.env.MAIL_IMAP_PORT ?? 143)
  const smtpHost = process.env.MAIL_SMTP_HOST ?? host
  const smtpPort = Number(process.env.MAIL_SMTP_PORT ?? 587)

  const accounts: MailAccount[] = []

  // Scan indexed accounts (MAIL_ACCOUNT_0_, MAIL_ACCOUNT_1_, ...)
  for (let i = 0; i <= 9; i++) {
    const email = process.env[`MAIL_ACCOUNT_${i}_EMAIL`]
    if (!email) break
    accounts.push({
      email,
      name: process.env[`MAIL_ACCOUNT_${i}_NAME`] ?? email.split('@')[0],
      provider: 'imap_smtp',
      password: process.env[`MAIL_ACCOUNT_${i}_PASSWORD`] ?? '',
      imapHost: host,
      imapPort,
      smtpHost,
      smtpPort,
    })
  }

  // Legacy fallback
  if (accounts.length === 0) {
    const email = process.env.MAIL_USER ?? ''
    if (email) {
      accounts.push({
        email,
        name: process.env.MAIL_FROM_NAME ?? email.split('@')[0],
        provider: 'imap_smtp',
        password: process.env.MAIL_PASSWORD ?? '',
        imapHost: host,
        imapPort,
        smtpHost,
        smtpPort,
      })
    }
  }

  return accounts
}

// Env accounts are static for the process lifetime — cache once.
let _envAccounts: MailAccount[] | null = null

// DB-backed accounts (user-added via the UI) — fetched fresh each call so
// add/remove reflects immediately with no cache-invalidation logic needed.
async function loadDbAccounts(): Promise<MailAccount[]> {
  const res = await databases.listDocuments(DB, COL, [Query.orderDesc('created_at')])
  if (res.documents.length === 0) return []

  return res.documents.map((row) => ({
    id: row.$id as string,
    email: row.email as string,
    name: row.name as string,
    provider: row.provider as MailAccount['provider'],
    password: row.encrypted_password ? decryptSecret(row.encrypted_password as string) : '',
    imapHost: row.imap_host as string,
    imapPort: row.imap_port as number,
    smtpHost: row.smtp_host as string,
    smtpPort: row.smtp_port as number,
  }))
}

export async function getAllAccounts(): Promise<MailAccount[]> {
  if (!_envAccounts) _envAccounts = loadAccounts()
  const dbAccounts = await loadDbAccounts()
  return [..._envAccounts, ...dbAccounts]
}

export async function getAccount(email: string): Promise<MailAccount | null> {
  const accounts = await getAllAccounts()
  return accounts.find((a) => a.email === email) ?? null
}

export async function getDefaultAccount(): Promise<MailAccount | null> {
  const accounts = await getAllAccounts()
  return accounts[0] ?? null
}

// Safe public list for client-side (no passwords)
export type PublicAccount = { id?: string; email: string; name: string; provider: MailAccount['provider'] }

export async function getPublicAccounts(): Promise<PublicAccount[]> {
  const accounts = await getAllAccounts()
  return accounts.map(({ id, email, name, provider }) => ({ id, email, name, provider }))
}

export interface CreateAccountInput {
  email: string
  name: string
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  password: string
}

export async function createDbAccount(input: CreateAccountInput): Promise<{ id: string }> {
  const { encrypted } = encryptSecret(input.password)
  const now = new Date().toISOString()

  const doc = await databases.createDocument(DB, COL, ID.unique(), {
    email: input.email,
    name: input.name,
    provider: 'imap_smtp',
    imap_host: input.imapHost,
    imap_port: input.imapPort,
    smtp_host: input.smtpHost,
    smtp_port: input.smtpPort,
    encrypted_password: encrypted,
    created_at: now,
  })

  return { id: doc.$id }
}

export async function deleteDbAccount(id: string): Promise<void> {
  await databases.deleteDocument(DB, COL, id)
}
