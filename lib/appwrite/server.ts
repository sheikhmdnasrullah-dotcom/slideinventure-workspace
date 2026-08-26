import "server-only"
import { Client, Databases, Users, Storage, Functions, ID, Permission, Role, Query } from "node-appwrite"

const client = new Client()
  .setEndpoint((process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1"))
  .setProject((process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc"))
  .setKey((process.env.APPWRITE_API_KEY || "build-key"))

export const appwriteClient = client
export const databases = new Databases(client)
export const users = new Users(client)
export const storage = new Storage(client)
export const functions = new Functions(client)

export { ID, Permission, Role, Query }
