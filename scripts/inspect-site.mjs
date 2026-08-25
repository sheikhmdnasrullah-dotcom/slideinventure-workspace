import { Client, Sites } from "node-appwrite"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const sites = new Sites(client)
const ID = "workspace_slidein"

const s = await sites.get(ID)
const cfg = [
  "framework","adapter","buildCommand","installCommand","outputDirectory",
  "buildRuntime","timeout","enabled","live","providerRepositoryId",
  "providerBranch","providerRootDirectory","installationId","deploymentId",
  "latestDeploymentId","latestDeploymentStatus"
]
console.log("=== CONFIG ===")
for (const k of cfg) console.log(k, "=", JSON.stringify(s[k]))

console.log("\n=== VARS (key: value?) ===")
for (const v of s.vars || []) {
  console.log(`${v.key}: ${v.value === "" ? "EMPTY" : "set"}`)
}
console.log("VAR COUNT:", (s.vars||[]).length)

console.log("\n=== DEPLOYMENTS ===")
const d = await sites.listDeployments(ID)
for (const x of d.deployments || []) {
  console.log(x.$id, x.status, x.type, x.$createdAt)
}
