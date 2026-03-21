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

  // Move CampaignManager import after mock if it exists
  const mockRegex = /vi\.mock\("@src\/renderer\/campaign\/CampaignManager"[\s\S]*?\}\);/;
  const importRegex = /import \{ CampaignManager \} from "@src\/renderer\/campaign\/CampaignManager";/;
  
  const mockMatch = content.match(mockRegex);
  const importMatch = content.match(importRegex);

  if (mockMatch && importMatch && importMatch.index! < mockMatch.index!) {
      // Remove import
      content = content.replace(importRegex, '');
      // Re-insert after mock
      const newMockMatch = content.match(mockRegex); // Refind since index changed
      const insertPos = newMockMatch!.index! + newMockMatch![0].length;
      content = content.slice(0, insertPos) + '\nimport { CampaignManager } from "@src/renderer/campaign/CampaignManager";' + content.slice(insertPos);
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed import order in: ${filePath}`);
  }
});
