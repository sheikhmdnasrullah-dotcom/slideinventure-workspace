import * as dotenv from 'dotenv';
import fs from 'fs';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const host = process.env.MAIL_IMAP_HOST ?? 'mail.nasrullahtanim.me'
const imapPort = Number(process.env.MAIL_IMAP_PORT ?? 143)
const smtpHost = process.env.MAIL_SMTP_HOST ?? host
const smtpPort = Number(process.env.MAIL_SMTP_PORT ?? 587)

const accounts = []
for (let i = 0; i <= 9; i++) {
  const email = process.env[`MAIL_ACCOUNT_${i}_EMAIL`]
  if (!email) break
  accounts.push({
    email,
    name: process.env[`MAIL_ACCOUNT_${i}_NAME`] ?? email.split('@')[0],
  })
}
console.log(accounts);
