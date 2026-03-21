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

  if (content.includes('const { bootstrap } = const { bootstrap } =')) {
      content = content.replace(/const\s+\{\s*bootstrap\s*\}\s*=\s*const\s+\{\s*bootstrap\s*\}\s*=\s*/g, 'const { bootstrap } = ');
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
  }
});

console.log("Bootstrap duplication fix complete.");
