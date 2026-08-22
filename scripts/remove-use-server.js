const fs = require('fs');
const path = require('path');

const libApiDir = path.join(__dirname, '../lib/api');

function removeUseServer(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      removeUseServer(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('"use server";')) {
        content = content.replace(/"use server";\n*/g, '');
        fs.writeFileSync(fullPath, content);
        console.log(`Removed "use server" from ${fullPath}`);
      }
    }
  }
}

removeUseServer(libApiDir);
