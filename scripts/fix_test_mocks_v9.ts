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
    let seenMockStorageProvider = false;
    
    for (let line of lines) {
        if (line.includes('import { CampaignManager } from "@src/renderer/campaign/CampaignManager";') || 
            line.includes('import { CampaignManager } from "@src/engine/managers/CampaignManager";')) {
            if (seenCampaignManager) continue;
            seenCampaignManager = true;
            newLines.push('import { CampaignManager } from "@src/renderer/campaign/CampaignManager";');
        } else if (line.includes('import { MetaManager } from "@src/renderer/campaign/MetaManager";') || 
                   line.includes('import { MetaManager } from "@src/engine/campaign/MetaManager";')) {
            if (seenMetaManager) continue;
            seenMetaManager = true;
            newLines.push('import { MetaManager } from "@src/renderer/campaign/MetaManager";');
        } else if (line.includes('import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";')) {
            if (seenMockStorageProvider) continue;
            seenMockStorageProvider = true;
            newLines.push(line);
        } else if (line.trim() === 'import { CampaignManager }') {
            // Broken import line from previous script
            continue;
        } else if (line.trim() === 'import { MetaManager }') {
            // Broken import line from previous script
            continue;
        } else {
            newLines.push(line);
        }
    }
    
    let updated = newLines.join('\n');
    
    // Fix the broken from lines again if they exist
    updated = updated.replace(/from "@src\/engine\/managers\/CampaignManager";/g, '');
    updated = updated.replace(/from "@src\/renderer\/campaign\/CampaignManager";/g, '');
    updated = updated.replace(/from "@src\/engine\/campaign\/CampaignManager";/g, '');

    if (updated !== content) {
      console.log('Polishing v9 ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
  }
});
