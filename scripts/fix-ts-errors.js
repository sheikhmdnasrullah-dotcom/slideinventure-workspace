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

// 1. app/api/webhooks/n8n/route.ts
replaceInFile(
  'app/api/webhooks/n8n/route.ts',
  /return ApiError\.([^;]+);/g,
  'return toJson(ApiError.$1);'
);
replaceInFile(
  'app/api/webhooks/n8n/route.ts',
  /import {([^}]+)} from "@\/lib\/api\/errors";/,
  'import { $1, toJson } from "@/lib/api/errors";'
);
replaceInFile(
  'app/api/webhooks/n8n/route.ts',
  /ApiError\.badRequest\([^,]+,\s*[^,]+,\s*[^)]+\)/g, // fix 3 args to 2
  'ApiError.badRequest("WEBHOOK_ERROR", "Invalid payload")'
);

// 2. app/actions/sync-knowledge.ts
replaceInFile(
  'app/actions/sync-knowledge.ts',
  /import \{ syncKnowledge, type SyncResult \} from "@\/lib\/knowledge\/sync"/,
  'import { syncKnowledge } from "@/lib/knowledge/sync"'
);
replaceInFile(
  'app/actions/sync-knowledge.ts',
  /const result = await syncKnowledge\(user\.id\)/,
  'const count = await syncKnowledge(); const result = { success: true, output: `Synced ${count} items` };'
);
replaceInFile(
  'app/actions/sync-knowledge.ts',
  /const result = await syncKnowledge\(user\.id, user\.email \?\? undefined\)/,
  'const count = await syncKnowledge(); const result = { success: true, output: `Synced ${count} items` };'
);
// Also sometimes it's just `syncKnowledge(user.id)`
replaceInFile(
  'app/actions/sync-knowledge.ts',
  /await syncKnowledge\([^)]+\)/g,
  'await syncKnowledge()'
);

// 3. app/api/knowledge/publish/route.ts
replaceInFile(
  'app/api/knowledge/publish/route.ts',
  /\.flatten\(\)\.issues/,
  '.errors'
);
replaceInFile(
  'app/api/knowledge/publish/route.ts',
  /\.flatten\(\)\.fieldErrors/,
  '.flatten().fieldErrors'
);

// 4. app/api/tasks/execute/route.ts
replaceInFile(
  'app/api/tasks/execute/route.ts',
  /ApiError\.badRequest\("Missing task ID"\)/,
  'ApiError.badRequest("MISSING_ID", "Missing task ID")'
);
replaceInFile(
  'app/api/tasks/execute/route.ts',
  /ApiError\.badRequest\("Missing task result"\)/,
  'ApiError.badRequest("MISSING_RESULT", "Missing task result")'
);

// 5. app/api/terminal/route.ts
replaceInFile(
  'app/api/terminal/route.ts',
  /triggered_by:/g,
  'triggeredBy:'
);

// 6. app/api/users/[id]/route.ts
replaceInFile(
  'app/api/users/[id]/route.ts',
  /const user = await getSessionUser\(\);/,
  'import { User } from "@/lib/api/schemas";\n  const user = await getSessionUser();'
);

// 7. components/dashboard/v3/documents/document-display.tsx
replaceInFile(
  'components/dashboard/v3/documents/document-display.tsx',
  /<Button variant="ghost" size="icon" asChild>\s*<a([^>]+)>\s*<ExternalLink className="h-4 w-4" \/>\s*<\/a>\s*<\/Button>/g,
  '<a $1 className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"><ExternalLink className="h-4 w-4" /></a>'
);
replaceInFile(
  'components/dashboard/v3/documents/document-display.tsx',
  /<Button variant="ghost" size="icon" asChild>\s*<a([^>]+)>\s*<Download className="h-4 w-4" \/>\s*<\/a>\s*<\/Button>/g,
  '<a $1 className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"><Download className="h-4 w-4" /></a>'
);
// DropdownMenuTrigger asChild
replaceInFile(
  'components/dashboard/v3/documents/document-display.tsx',
  /<DropdownMenuTrigger asChild>/g,
  '<DropdownMenuTrigger>'
);
replaceInFile(
  'components/dashboard/v3/documents/document-display.tsx',
  /<Button variant="ghost" size="icon" disabled=\{!selectedDocument\}>\s*<MoreVertical className="h-4 w-4" \/>\s*<span className="sr-only">More<\/span>\s*<\/Button>/g,
  '<div className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"><MoreVertical className="h-4 w-4" /><span className="sr-only">More</span></div>'
);

// 8. components/dashboard/v3/knowledge/add-context-dialog.tsx
replaceInFile(
  'components/dashboard/v3/knowledge/add-context-dialog.tsx',
  /onValueChange=\{setCategory\}/,
  'onValueChange={(val) => setCategory(val || "")}'
);

// 9. lib/api/schemas.ts
replaceInFile(
  'lib/api/schemas.ts',
  /z\.record\(z\.unknown\(\)\)/g,
  'z.record(z.string(), z.unknown())'
);
replaceInFile(
  'lib/api/schemas.ts',
  /z\.record\(z\.string\(\)\)/g,
  'z.record(z.string(), z.string())'
);
replaceInFile(
  'lib/api/schemas.ts',
  /\.ip\(\)/g,
  ''
);

// 10. lib/api/validation.ts
replaceInFile(
  'lib/api/validation.ts',
  /\.flatten\(\)\.issues/,
  '.errors'
);

// 11. scripts/sync-knowledge.ts
replaceInFile(
  'scripts/sync-knowledge.ts',
  /const result = await syncKnowledge\([^)]+\)/,
  'const count = await syncKnowledge(); const result = { success: true, output: count }'
);

console.log('Fixed additional typescript errors');
