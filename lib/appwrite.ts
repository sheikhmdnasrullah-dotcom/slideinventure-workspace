import { Client, Account, Databases } from "appwrite";

const client = new Client()
  .setEndpoint("https://nyc.cloud.appwrite.io/v1")
  .setProject("6a8cf7090015800700cc");

const account = new Account(client);
const databases = new Databases(client);

// Pings the Appwrite backend to verify the SDK/endpoint/project setup.
// Automatically called when the app opens (see components/appwrite-ping.tsx).
export function pingAppwrite() {
  return client.ping();
}

export { client, account, databases };
