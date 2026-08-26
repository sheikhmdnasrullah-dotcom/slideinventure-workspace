import { Client, Databases, Query } from "node-appwrite";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const databases = new Databases(client);
const DB = env.APPWRITE_DATABASE_ID || "workspace";

const res = await databases.listDocuments(DB, "affine_workspaces", [
  Query.equal("section", "brainstorm"),
  Query.limit(50),
]);
for (const d of res.documents) {
  console.log(d.$id, "| user_email:", JSON.stringify(d.user_email), "| snapshot type:", typeof d.snapshot);
}
