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
    let updated = content;
    
    // 1. Fix new MetaManager() without arguments
    updated = updated.replace(/new MetaManager\(\)/g, 'new MetaManager(new MockStorageProvider())');
    
    // 2. Add metaManager to CampaignScreen constructor if missing
    if (updated.includes('new CampaignScreen({') && !updated.includes('metaManager:')) {
        console.log('Adding metaManager to CampaignScreen in ' + filePath);
        updated = updated.replace(/new CampaignScreen\(\{/, 'new CampaignScreen({\n      metaManager: new MetaManager(new MockStorageProvider()),');
    }

    // 3. Fix the double-parentheses issue again just in case
    updated = updated.replace(/new MetaManager\(new MockStorageProvider\(\)\)\);/g, 'new MetaManager(new MockStorageProvider()));');
    
    // 4. Fix new CampaignManager(storage, new MetaManager(new MockStorageProvider())).reset() -> it needs storage too
    // This is for the reset() calls I saw in FullCampaignFlow.test.ts
    updated = updated.replace(/new MetaManager\(\)\.reset\(\)/g, 'new MetaManager(new MockStorageProvider()).reset()');

    if (updated !== content) {
      console.log('Polishing v7 ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
  }
});
