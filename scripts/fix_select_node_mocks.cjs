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

const campaignManagerFiles = findFiles('tests', 'vi.mock("@src/renderer/campaign/CampaignManager"');
console.log(`Found ${campaignManagerFiles.length} files for CampaignManager mock update`);

campaignManagerFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Pattern: getState: vi.fn(...),
  // Add selectNode: vi.fn(), if missing
  if (content.includes('getState:') && !content.includes('selectNode:')) {
      content = content.replace(
          /(getState:[^,]*?,)/,
          `$1
    selectNode: vi.fn(),`
      );
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated selectNode in ${file}`);
  }
});
