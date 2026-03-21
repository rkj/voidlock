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

  // Add inputDispatcher to mocks if missing but needed
  if (content.includes('inputDispatcher') && !content.includes('pushContext:')) {
      // Find where inputDispatcher is defined in a mock object
      const inputDispatcherRegex = /inputDispatcher: \{\}/;
      if (inputDispatcherRegex.test(content)) {
          content = content.replace(inputDispatcherRegex, 'inputDispatcher: { pushContext: vi.fn(), popContext: vi.fn() }');
          changed = true;
      }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed inputDispatcher in: ${filePath}`);
  }
});
