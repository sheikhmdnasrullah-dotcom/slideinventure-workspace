import "server-only"
import { Client, Databases, Users, Storage, Functions, ID, Permission, Role } from "node-appwrite"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!)

export const appwriteClient = client
export const databases = new Databases(client)
export const users = new Users(client)
export const storage = new Storage(client)
export const functions = new Functions(client)

export { ID, Permission, Role }
