const fs = require('fs');
const path = require('path');

function findFiles(dir, pattern) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, pattern));
    } else if (file.endsWith('.test.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(pattern)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const configManagerFiles = findFiles('tests', 'vi.mock("@src/renderer/ConfigManager"');
console.log(`Found ${configManagerFiles.length} files for ConfigManager mock update`);

configManagerFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Pattern: getDefault: vi.fn(...),
  // Add squadConfig if missing
  if (content.includes('getDefault:') && !content.includes('squadConfig:')) {
      content = content.replace(
          /(getDefault:[^}]*?)\}/,
          `$1, squadConfig: { soldiers: [] } }`
      );
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated getDefault in ${file}`);
  }
});
