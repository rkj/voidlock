import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function getFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const allTestFiles = getFiles(path.join(projectRoot, 'tests/renderer'));

allTestFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace await import("@src/renderer/main") with manual bootstrap call
  const mainImportRegex = /await import\("@src\/renderer\/main"\);/g;
  if (mainImportRegex.test(content)) {
      content = content.replace(mainImportRegex, 'const { bootstrap } = await import("@src/renderer/main");\n    bootstrap();');
      changed = true;
  }

  // Also handle relative imports if any
  const relativeMainImportRegex = /await import\("\.\.\/\.\.\/src\/renderer\/main"\);/g;
  if (relativeMainImportRegex.test(content)) {
      content = content.replace(relativeMainImportRegex, 'const { bootstrap } = await import("../../src/renderer/main");\n    bootstrap();');
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated bootstrap in: ${filePath}`);
  }
});
