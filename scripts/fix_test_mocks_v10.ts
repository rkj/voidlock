import * as fs from 'fs';
import * as path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

walk('tests', (filePath) => {
  if (filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let lines = content.split('\n');
    let newLines: string[] = [];
    
    let seenCampaignManager = false;
    let seenMetaManager = false;
    
    for (let line of lines) {
        let trimmed = line.trim();
        if (trimmed.startsWith('import { CampaignManager }')) {
            if (seenCampaignManager) continue;
            newLines.push('import { CampaignManager } from "@src/renderer/campaign/CampaignManager";');
            seenCampaignManager = true;
        } else if (trimmed.startsWith('import { MetaManager }')) {
            if (seenMetaManager) continue;
            newLines.push('import { MetaManager } from "@src/renderer/campaign/MetaManager";');
            seenMetaManager = true;
        } else if (trimmed.startsWith('from "@src/renderer/campaign/CampaignManager"') || 
                   trimmed.startsWith('from "@src/engine/managers/CampaignManager"') ||
                   trimmed.startsWith('from "@src/engine/campaign/CampaignManager"')) {
            continue;
        } else {
            newLines.push(line);
        }
    }
    
    let updated = newLines.join('\n');
    
    // Final check for the triple-parentheses and other syntax errors
    updated = updated.replace(/new CampaignManager\(storage, new MetaManager\(new MockStorageProvider\(\)\)\)\)\.reset\(\)/g, 'new CampaignManager(storage, new MetaManager(new MockStorageProvider())).reset()');
    updated = updated.replace(/new CampaignManager\(new MockStorageProvider\(\), new MetaManager\(new MockStorageProvider\(\)\)\)\)\)/g, 'new CampaignManager(new MockStorageProvider(), new MetaManager(new MockStorageProvider())))');

    if (updated !== content) {
      console.log('Polishing v10 ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
  }
});
