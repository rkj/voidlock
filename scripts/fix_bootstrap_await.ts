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

  // Replace bootstrap() with await bootstrap() if inside async function
  // and not already awaited
  if (content.includes('bootstrap()') && !content.includes('await bootstrap()')) {
      content = content.replace(/bootstrap\(\)/g, 'await bootstrap()');
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  }
});

console.log("Bootstrap await fix complete.");
