import { readFileSync } from "node:fs"
import { Client, Sites, ID, Query } from "node-appwrite"
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
  const all = []
  let page = await sites.listVariables(SITE, [Query.limit(100)])
  all.push(...(page.variables || []))
  while (page.variables && page.variables.length === 100) {
    const last = page.variables[page.variables.length - 1]
    page = await sites.listVariables(SITE, [Query.limit(100), Query.cursorAfter(last.$id)])
    all.push(...(page.variables || []))
  }
  const map = new Map(all.map((v) => [v.key, v]))
  for (const key of desired) {
    const value = env[key]
    if (typeof value !== "string" || value.length > 8192) {
      console.log(`SKIP/problem ${key}: type=${typeof value} len=${value?.length}`)
      continue
    }
    const cur = map.get(key)
    try {
      if (cur) {
        // keep the existing secret flag; only update key/value
        await sites.updateVariable(SITE, cur.$id, key, value, cur.secret)
        console.log(`updated ${key}`)
      } else {
        const secret = !key.startsWith("NEXT_PUBLIC_")
        await sites.createVariable(SITE, ID.unique(), key, value, secret)
        console.log(`created ${key}`)
      }
    } catch (e) {
      console.log(`ERROR ${key}: ${e.message}`)
    }
  }

  // Probe: prove secret writes actually persist (non-secret value is returned by API)
  try {
    await sites.createVariable(SITE, ID.unique(), "_probe", "probe-ok", false)
    const allP = []
    let pp = await sites.listVariables(SITE, [Query.limit(100)])
    allP.push(...(pp.variables || []))
    while (pp.variables && pp.variables.length === 100) {
      const last = pp.variables[pp.variables.length - 1]
      pp = await sites.listVariables(SITE, [Query.limit(100), Query.cursorAfter(last.$id)])
      allP.push(...(pp.variables || []))
    }
    const probe = (allP).find((v) => v.key === "_probe")
    const got = probe ? await sites.getVariable(SITE, probe.$id) : null
    console.log(`PROBE write persisted: ${got && got.value === "probe-ok" ? "YES" : "NO (" + (got && got.value) + ")"}`)
    if (probe) await sites.deleteVariable(SITE, probe.$id)
  } catch (e) {
    console.log("PROBE error:", e.message)
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
