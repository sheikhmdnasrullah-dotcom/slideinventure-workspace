const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

function processApiRoutes(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processApiRoutes(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Fix .toResponse() calls that are appended incorrectly or at the end
      if (content.includes('.toResponse()')) {
        content = content.replace(/\.toResponse\(\)/g, '');
        changed = true;
      }
      
      // We also need to wrap ApiError.*(...) with toJson(...) if it's not already wrapped
      // but only if it's in a return statement.
      // E.g. return ApiError.internal("DB_ERROR", error.message);
      if (content.match(/return\s+ApiError\.([a-zA-Z]+)\(([^;]*)\);/g)) {
        content = content.replace(/return\s+ApiError\.([a-zA-Z]+)\(([^;]*)\);/g, 'return toJson(ApiError.$1($2));');
        changed = true;
      }

      if (changed) {
        // Ensure toJson is imported if we are using it
        if (!content.includes('toJson')) {
           content = content.replace(/import\s+{([^}]+)}\s+from\s+"@\/lib\/api\/errors";/, 'import { $1, toJson } from "@/lib/api/errors";');
        }
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      }
    }
  }
}

processApiRoutes(path.join(projectRoot, 'app', 'api'));
