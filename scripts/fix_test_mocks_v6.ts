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
    
    // 1. Fix the double-from issue
    updated = updated.replace(/\} from "@src\/engine\/persistence\/MockStorageProvider"; from "@src\/engine\/managers\/CampaignManager";/g, '} from "@src/engine/persistence/MockStorageProvider";\nimport { CampaignManager } from "@src/engine/managers/CampaignManager";');
    updated = updated.replace(/\} from "@src\/engine\/persistence\/MockStorageProvider"; from "@src\/renderer\/campaign\/CampaignManager";/g, '} from "@src/engine/persistence/MockStorageProvider";\nimport { CampaignManager } from "@src/renderer/campaign/CampaignManager";');
    
    // 2. Fix the triple-closing-paren issue
    updated = updated.replace(/new MetaManager\(new MockStorageProvider\(\)\)\)\);/g, 'new MetaManager(new MockStorageProvider()));');
    updated = updated.replace(/new MetaManager\(new MockStorageProvider\(\)\)\);/g, 'new MetaManager(new MockStorageProvider()));');
    
    // 3. Fix the "Unexpected ," issue if it still exists
    updated = updated.replace(/new CampaignManager\(new MockStorageProvider\(\), new MetaManager\(new MockStorageProvider\(\)\)\)\);/g, 'new CampaignManager(new MockStorageProvider(), new MetaManager(new MockStorageProvider()));');

    // 4. Fix specific messy lines in engine tests
    // import { MetaManager } from "@src/renderer/campaign/MetaManager"; from "@src/engine/managers/CampaignManager";
    updated = updated.replace(/import \{ MetaManager \} from "@src\/renderer\/campaign\/MetaManager"; from "@src\/engine\/managers\/CampaignManager";/g, 'import { MetaManager } from "@src/renderer/campaign/MetaManager";\nimport { CampaignManager } from "@src/engine/managers/CampaignManager";');

    if (updated !== content) {
      console.log('Polishing ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
  }
});
