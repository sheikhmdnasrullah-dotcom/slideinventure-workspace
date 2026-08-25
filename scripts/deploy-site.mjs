import { readFileSync } from "node:fs"
import { Client, Sites, ID } from "node-appwrite"
import { InputFile } from "node-appwrite/file"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const sites = new Sites(client)
const SITE = "workspace_slidein"

function parseEnv(path) {
  const out = {}
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

async function ensureVars() {
  const env = parseEnv(".env.local")
  const desired = Object.keys(env).filter((k) => k !== "VERCEL_OIDC_TOKEN")
  const existing = await sites.listVariables(SITE)
  const map = new Map((existing.variables || []).map((v) => [v.key, v]))
  for (const key of desired) {
    const value = env[key]
    if (typeof value !== "string" || value.length > 8192) {
      console.log(`SKIP/problem ${key}: type=${typeof value} len=${value?.length}`)
      continue
    }
    const secret = !key.startsWith("NEXT_PUBLIC_")
    const cur = map.get(key)
    try {
      if (cur) {
        await sites.updateVariable(SITE, cur.$id, key, value, secret)
        console.log(`updated ${key}`)
      } else {
        await sites.createVariable(SITE, ID.unique(), key, value, secret)
        console.log(`created ${key}`)
      }
    } catch (e) {
      if (/non-secret/i.test(e.message) && cur) {
        try {
          await sites.deleteVariable(SITE, cur.$id)
          await sites.createVariable(SITE, ID.unique(), key, value, secret)
          console.log(`recreated ${key} as secret=${secret}`)
        } catch (e2) {
          console.log(`ERROR recreating ${key}: ${e2.message}`)
        }
      } else {
        console.log(`ERROR ${key}: ${e.message}`)
      }
    }
  }
  console.log(`\nDone. ${desired.length} variables ensured.`)
}

async function deploy(tarPath) {
  const input = InputFile.fromPath(tarPath, "source.tar.gz")
  const dep = await sites.createDeployment(SITE, input, undefined, undefined, undefined, true)
  console.log("Deployment created:", dep.$id, "status:", dep.status)
}

const mode = process.argv[2]
if (mode === "vars") await ensureVars()
else if (mode === "deploy") await deploy(process.argv[3])
else console.log("usage: node deploy-site.mjs vars | deploy <tar.gz>")
