import { Client, Databases, Query } from "node-appwrite";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf-8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}));
const client = new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY);
const databases = new Databases(client);
const res = await databases.listDocuments(env.APPWRITE_DATABASE_ID||"workspace", "affine_workspaces", [Query.equal("section","brainstorm"), Query.orderDesc("updated_at"), Query.limit(3)]);
for (const d of res.documents) {
  console.log(d.$id, d.title, d.updated_at, "snapshot has content:", typeof d.snapshot === "string" && d.snapshot.includes("Testing the brainstorm"));
}
