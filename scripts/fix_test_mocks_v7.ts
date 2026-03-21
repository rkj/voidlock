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

  // Fix currentCampaignState ReferenceError
  if (content.includes('currentCampaignState =') && !content.includes('let currentCampaignState')) {
      // Find where describe starts
      const describeMatch = content.match(/describe\(/);
      if (describeMatch) {
          const insertPos = describeMatch.index!;
          content = content.slice(0, insertPos) + "let currentCampaignState: any = null;\n" + content.slice(insertPos);
          changed = true;
      }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  }
});
