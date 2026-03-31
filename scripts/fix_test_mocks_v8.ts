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
    
    // 2. Add metaManager to CampaignScreen constructor if missing (handles multiple occurrences)
    const parts = updated.split('new CampaignScreen({');
    if (parts.length > 1) {
        let newContent = parts[0];
        for (let i = 1; i < parts.length; i++) {
            if (!parts[i].trim().startsWith('metaManager:')) {
                newContent += 'new CampaignScreen({\n      metaManager: new MetaManager(new MockStorageProvider()),' + parts[i];
            } else {
                newContent += 'new CampaignScreen({' + parts[i];
            }
        }
        updated = newContent;
    }

    if (updated !== content) {
      console.log('Polishing v8 ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
  }
});
