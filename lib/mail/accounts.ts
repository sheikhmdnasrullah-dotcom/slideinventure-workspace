import 'server-only'

export interface MailAccount {
  email: string
  name: string
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

// Cached at module scope (one load per server process)
let _accounts: MailAccount[] | null = null

export function getAllAccounts(): MailAccount[] {
  if (!_accounts) _accounts = loadAccounts()
  return _accounts
}

export function getAccount(email: string): MailAccount | null {
  return getAllAccounts().find((a) => a.email === email) ?? null
}

export function getDefaultAccount(): MailAccount | null {
  return getAllAccounts()[0] ?? null
}

// Safe public list for client-side (no passwords)
export type PublicAccount = { email: string; name: string }

export function getPublicAccounts(): PublicAccount[] {
  return getAllAccounts().map(({ email, name }) => ({ email, name }))
}
