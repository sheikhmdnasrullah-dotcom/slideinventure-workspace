const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

function replaceInFile(filePath, replacements) {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  for (const [search, replace] of replacements) {
    if (content.match(search)) {
      content = content.replace(search, replace);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(fullPath, content);
  }
}

// Global replace in all route.ts
function processApiRoutes(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processApiRoutes(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Fix return types
      if (content.match(/: Promise<ApiError\s*\|\s*Response>/g)) {
        content = content.replace(/: Promise<ApiError\s*\|\s*Response>/g, '');
        changed = true;
      }
      if (content.match(/: Promise<ApiError\s*\|\s*NextResponse[^>]+>>/g)) {
        content = content.replace(/: Promise<ApiError\s*\|\s*NextResponse[^>]+>>/g, '');
        changed = true;
      }

      // Fix getSessionUser
      if (content.match(/const\s+user\s*=\s*getSessionUser\(\);/)) {
        content = content.replace(/const\s+user\s*=\s*getSessionUser\(\);/g, 'const user = await getSessionUser();');
        changed = true;
      }

      // Fix missing toJson wrapping for ApiError (just in case)
      if (content.match(/return ApiError\./)) {
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

// Specific fixes
replaceInFile('app/api/terminal/route.ts', [
  [/triggered_by:/g, 'triggeredBy:']
]);

replaceInFile('app/api/webhooks/n8n/route.ts', [
  [/ApiError\.badRequest\([^)]+\)/g, 'ApiError.badRequest("WEBHOOK_ERROR", "Invalid payload")']
]);

replaceInFile('lib/api/validation.ts', [
  [/\.flatten\(\)\.issues/g, '.flatten().fieldErrors']
]);

console.log('Fixed additional typescript errors 2');
