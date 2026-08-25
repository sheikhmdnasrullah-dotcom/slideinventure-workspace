import { readFileSync, writeFileSync } from "node:fs"

const cfg = JSON.parse(readFileSync("appwrite.config.json", "utf8"))
const env = {}
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const t = l.trim()
  if (!t || t.startsWith("#")) continue
  const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) v = v.slice(1, -1)
  env[m[1]] = v
}
const vars = {}
for (const k of Object.keys(env)) if (k !== "VERCEL_OIDC_TOKEN") vars[k] = env[k]
cfg.sites[0].variables = vars
writeFileSync("appwrite.config.json", JSON.stringify(cfg, null, 2))
console.log("appwrite.config.json updated with", Object.keys(vars).length, "site variables")
