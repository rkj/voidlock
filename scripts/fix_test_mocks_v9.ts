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

  // Replace AssetManager.getInstance() with a mock if it's being used in tests that don't mock the constructor
  if (content.includes('AssetManager.getInstance()')) {
      // If AssetManager is not already mocked as a constructor, we might need to fix it
      // But for now, let's just make sure getInstance() returns something sensible if we can't easily fix the constructor mock
      
      // Check if we already have a mockAssetManager defined
      if (content.includes('const mockAssetManager =')) {
          content = content.replace(/AssetManager\.getInstance\(\)/g, 'mockAssetManager');
          changed = true;
      } else if (content.includes('let assetManager: any;')) {
          // It's likely assigned in beforeEach
          content = content.replace(/AssetManager\.getInstance\(\)/g, 'mockAssetManager');
          changed = true;
      }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated getInstance in: ${filePath}`);
  }
});
