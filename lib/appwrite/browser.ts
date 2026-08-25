import { Client, Account, ID } from "appwrite"

export function createBrowserClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)

  return { client, account: new Account(client), id: ID }
}
