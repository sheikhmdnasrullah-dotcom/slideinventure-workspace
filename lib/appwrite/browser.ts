import { Client, Account, ID } from "appwrite"

export function createBrowserClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "6a8cf7090015800700cc")

  return { client, account: new Account(client), id: ID }
}
