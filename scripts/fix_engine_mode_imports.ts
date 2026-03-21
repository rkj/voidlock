import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function getFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.resolve(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allTestFiles = getFiles(path.join(projectRoot, 'tests'));

allTestFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (content.includes('EngineMode') && !content.includes('import {') && !content.includes('from "@src/shared/types"')) {
      // This case is rare, usually there is some shared types import.
      // But let's handle if it's completely missing
      content = 'import { EngineMode } from "@src/shared/types";\n' + content;
      changed = true;
  } else if (content.includes('EngineMode') && content.includes('from "@src/shared/types"')) {
      // Add to existing import
      content = content.replace(/import\s*\{([^}]*)\}\s*from\s*["']@src\/shared\/types["']/, (match, imports) => {
          if (!imports.includes('EngineMode')) {
              return `import {${imports.trim()}, EngineMode} from "@src/shared/types"`;
          }
          return match;
      });
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
  }
});

console.log("EngineMode import fix complete.");
