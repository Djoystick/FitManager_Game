const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Check if file uses tg_user_id
      if (content.includes("cookieStore.get('tg_user_id')")) {
        // Add import { verifySession } from '@/lib/session'; if not there
        if (!content.includes("import { verifySession }")) {
          // Find the last import
          const importRegex = /^import .+ from .+;/gm;
          let match;
          let lastIndex = 0;
          while ((match = importRegex.exec(content)) !== null) {
            lastIndex = match.index + match[0].length;
          }
          if (lastIndex > 0) {
            content = content.slice(0, lastIndex) + "\nimport { verifySession } from '@/lib/session';" + content.slice(lastIndex);
          } else {
            content = "import { verifySession } from '@/lib/session';\n" + content;
          }
        }

        // Replace `const userId = cookieStore.get('tg_user_id')?.value;` or similar
        content = content.replace(/cookieStore\.get\('tg_user_id'\)\?\.value/g, "(await verifySession())");
        
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

replaceInDir(path.join(__dirname, 'app'));
