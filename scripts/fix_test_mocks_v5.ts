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
    
    // 1. Cleanup broken imports from previous runs
    updated = updated.replace(/import \{ MetaManager \}; from "[^"]+";/g, '');
    updated = updated.replace(/import \{ MetaManager \} from "@src\/renderer\/campaign\/MetaManager";\s+from "@src\/engine\/managers\/CampaignManager";/g, 'import { MetaManager } from "@src/renderer/campaign/MetaManager";\nimport { CampaignManager } from "@src/engine/managers/CampaignManager";');
    
    // 2. Fix duplicated/broken imports
    updated = updated.replace(/import \{ CampaignManager \} from "@src\/renderer\/campaign\/CampaignManager";\s+import \{ MetaManager \} from "@src\/renderer\/campaign\/MetaManager";/g, 'import { CampaignManager } from "@src/renderer/campaign/CampaignManager";\nimport { MetaManager } from "@src/renderer/campaign/MetaManager";');
    
    // 3. Fix the "Unexpected ," issue in constructor calls
    updated = updated.replace(/new CampaignManager\(, /g, 'new CampaignManager(new MockStorageProvider(), ');
    updated = updated.replace(/new CampaignManager\(new MockStorageProvider\(, /g, 'new CampaignManager(new MockStorageProvider(), ');
    
    // 4. Ensure CampaignManager constructor always has 2 arguments if it's being instantiated with MockStorageProvider
    // This is a bit tricky but most tests follow a pattern.
    updated = updated.replace(/new CampaignManager\(storage\)/g, 'new CampaignManager(storage, new MetaManager(new MockStorageProvider()))');
    updated = updated.replace(/new CampaignManager\(mockStorage\)/g, 'new CampaignManager(mockStorage, new MetaManager(new MockStorageProvider()))');
    updated = updated.replace(/new CampaignManager\(new MockStorageProvider\(\)\)/g, 'new CampaignManager(new MockStorageProvider(), new MetaManager(new MockStorageProvider()))');

    // 5. Cleanup the specific messy import line I saw in logs
    // import { MetaManager } from "@src/renderer/campaign/MetaManager"; from "@src/engine/managers/CampaignManager";
    updated = updated.replace(/import \{ MetaManager \} from "@src\/renderer\/campaign\/MetaManager"; from "@src\/engine\/managers\/CampaignManager";/g, 'import { MetaManager } from "@src/renderer/campaign/MetaManager";\nimport { CampaignManager } from "@src/engine/managers/CampaignManager";');

    // 6. Fix AssetManager.setInstance issue
    updated = updated.replace(/AssetManager\.setInstance\(assetManager\);/g, '// AssetManager.setInstance(assetManager);');

    if (updated !== content) {
      console.log('Finalizing ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
  }
});
