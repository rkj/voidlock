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

  // 1. Fix duplicate getRenderableState
  if (content.includes('getRenderableState: vi.fn().mockReturnValue({}),')) {
    const lines = content.split('\n');
    let newLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('getRenderableState: vi.fn().mockReturnValue({}),')) {
            const nextLineHasIt = i + 1 < lines.length && lines[i+1].includes('getRenderableState:');
            const prevLineHasIt = i - 1 >= 0 && lines[i-1].includes('getRenderableState:');
            if (nextLineHasIt || prevLineHasIt) {
                changed = true;
                continue; // Skip this line
            }
        }
        newLines.push(lines[i]);
    }
    content = newLines.join('\n');
  }

  // 2. Fix CampaignShell constructor in tests
  if (content.includes('new CampaignShell(')) {
      const searchStr = 'new CampaignShell({';
      let startIdx = 0;
      while ((startIdx = content.indexOf(searchStr, startIdx)) !== -1) {
          let braceCount = 1;
          let endIdx = -1;
          const bodyStart = startIdx + searchStr.length;
          for (let i = bodyStart; i < content.length; i++) {
              if (content[i] === '{') braceCount++;
              else if (content[i] === '}') braceCount--;
              
              if (braceCount === 0) {
                  endIdx = i;
                  break;
              }
          }
          
          if (endIdx !== -1) {
              const body = content.substring(bodyStart, endIdx);
              if (!body.includes('inputDispatcher:')) {
                  const newBody = body.trim() + ',\n      inputDispatcher: { pushContext: vi.fn(), popContext: vi.fn() } as any';
                  content = content.substring(0, bodyStart) + newBody + content.substring(endIdx);
                  changed = true;
                  startIdx = startIdx + searchStr.length + newBody.length + 1;
              } else {
                  startIdx = endIdx + 1;
              }
          } else {
              startIdx += searchStr.length;
          }
      }
  }

  // 3. Fix Renderer/GameRenderer constructor in tests
  if (content.includes('new Renderer(') || content.includes('new GameRenderer(')) {
      const searchStrs = ['new Renderer({', 'new GameRenderer({'];
      for (const searchStr of searchStrs) {
          let startIdx = 0;
          while ((startIdx = content.indexOf(searchStr, startIdx)) !== -1) {
              let braceCount = 1;
              let endIdx = -1;
              const bodyStart = startIdx + searchStr.length;
              for (let i = bodyStart; i < content.length; i++) {
                  if (content[i] === '{') braceCount++;
                  else if (content[i] === '}') braceCount--;
                  
                  if (braceCount === 0) {
                      endIdx = i;
                      break;
                  }
              }
              
              if (endIdx !== -1) {
                  const body = content.substring(bodyStart, endIdx);
                  let newBody = body.trim();
                  let localChanged = false;
                  if (!body.includes('themeManager:')) {
                      newBody += ',\n      themeManager: { getColor: vi.fn().mockReturnValue("#fff"), getAssetUrl: vi.fn(), getIconUrl: vi.fn() } as any';
                      localChanged = true;
                  }
                  if (!body.includes('assetManager:')) {
                      newBody += ',\n      assetManager: { iconImages: {}, unitSprites: {}, enemySprites: {}, getEnemySprite: vi.fn(), getUnitSprite: vi.fn(), getMiscSprite: vi.fn(), getIcon: vi.fn() } as any';
                      localChanged = true;
                  }
                  if (localChanged) {
                      content = content.substring(0, bodyStart) + newBody + content.substring(endIdx);
                      changed = true;
                      startIdx = startIdx + searchStr.length + newBody.length + 1;
                  } else {
                      startIdx = endIdx + 1;
                  }
              } else {
                  startIdx += searchStr.length;
              }
          }
      }
  }

  // 4. Fix InputDispatcher reference errors
  if ((content.includes('InputDispatcher.getInstance()') || content.includes('InputDispatcher as any')) && !content.includes('import { InputDispatcher }')) {
      content = 'import { InputDispatcher } from "@src/renderer/InputDispatcher";\n' + content;
      changed = true;
  }
  
  // 5. Fix CampaignManager reference errors
  if (content.includes('CampaignManager.getInstance()') && !content.includes('import { CampaignManager }')) {
      content = 'import { CampaignManager } from "@src/renderer/campaign/CampaignManager";\n' + content;
      changed = true;
  }

  // 6. Fix MetaManager reference errors
  if (content.includes('MetaManager.getInstance()') && !content.includes('import { MetaManager }')) {
      content = 'import { MetaManager } from "@src/renderer/campaign/MetaManager";\n' + content;
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  }
});

console.log("Refactor issues fix complete.");
