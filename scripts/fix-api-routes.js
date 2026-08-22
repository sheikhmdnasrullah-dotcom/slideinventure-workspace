const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const libApiDir = path.join(projectRoot, 'lib', 'api');
const filesToRemoveUseServer = ['errors.ts', 'schemas.ts', 'validation.ts', 'audit.ts', 'rate-limit.ts'];

for (const file of filesToRemoveUseServer) {
  const fullPath = path.join(libApiDir, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/^"use server";\n?/, '');
    fs.writeFileSync(fullPath, content);
  }
}

const schemasPath = path.join(libApiDir, 'schemas.ts');
if (fs.existsSync(schemasPath)) {
  let schemasContent = fs.readFileSync(schemasPath, 'utf8');
  if (!schemasContent.includes('export const DEFAULT_COLUMNS')) {
    schemasContent += `\nexport const DEFAULT_COLUMNS: LeadColumnConfig[] = [
  { id: "name", key: "name", label: "Name", visible: true, sortable: true, filterable: true, type: "composite" },
  { id: "email", key: "email", label: "Email", visible: true, sortable: true, filterable: true, type: "text" },
  { id: "status", key: "status", label: "Status", visible: true, sortable: true, filterable: true, type: "status" },
];\n`;
    fs.writeFileSync(schemasPath, schemasContent);
  }
}

function processApiRoutes(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processApiRoutes(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      if (content.includes('const user = getSessionUser();')) {
        content = content.split('const user = getSessionUser();').join('const user = await getSessionUser();');
        changed = true;
      }

      if (content.includes('return ApiError')) {
        if (!content.includes('toJson')) {
          content = content.replace(/import\s+{([^}]+)}\s+from\s+"@\/lib\/api\/errors";/, 'import { $1, toJson } from "@/lib/api/errors";');
        }
        content = content.replace(/return ApiError\.([a-zA-Z0-9_]+)\(([^;]*)\);/g, 'return toJson(ApiError.$1($2));');
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

processApiRoutes(path.join(projectRoot, 'app', 'api'));

console.log('Fixed API routes');
