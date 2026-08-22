const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

function replaceInFile(filePath, searchRegex, replaceWith) {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(searchRegex, replaceWith);
  fs.writeFileSync(fullPath, content);
}

// 1. app/api/tasks/execute/route.ts
replaceInFile(
  'app/api/tasks/execute/route.ts',
  /z\.record\(z\.unknown\(\)\)/g,
  'z.record(z.string(), z.unknown())'
);

// 2. app/api/knowledge/publish/route.ts
replaceInFile(
  'app/api/knowledge/publish/route.ts',
  /validated\.error\.errors/g,
  'validated.error.issues'
);

// 3. app/api/terminal/route.ts
replaceInFile(
  'app/api/terminal/route.ts',
  /triggered_by:/g,
  'triggeredBy:'
);
replaceInFile(
  'app/api/terminal/route.ts',
  /z\.record\(z\.unknown\(\)\)/g,
  'z.record(z.string(), z.unknown())'
);

// 4. app/api/webhooks/n8n/route.ts
replaceInFile(
  'app/api/webhooks/n8n/route.ts',
  /ApiError\.badRequest\([^,]+,\s*[^,]+,\s*[^)]+\)/g, // fix 3 args to 2
  'ApiError.badRequest("WEBHOOK_ERROR", "Invalid payload")'
);

console.log('Fixed remaining typescript errors');
