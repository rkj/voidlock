import * as fs from 'fs';
import * as path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

const patterns = [
  // 1. Remove getInstance fallback pattern
  {
    regex: /\(typeof mockInputDispatcher !== 'undefined' \? mockInputDispatcher : InputDispatcher\.getInstance\(\)\)/g,
    replace: 'mockInputDispatcher'
  },
  // 2. Remove static instance setup in mocks
  {
    regex: /\(mockConstructor as any\)\.getInstance = vi\.fn\(\)\.mockReturnValue\(mockInstance\);/g,
    replace: ''
  },
  {
    regex: /getInstance: vi\.fn\(\)\.mockReturnValue\(mockInstance\),/g,
    replace: ''
  },
  // 3. Fix CampaignManager.getInstance call
  {
    regex: /CampaignManager\.getInstance\(/g,
    replace: 'new CampaignManager('
  },
  // 4. Fix MetaManager.getInstance call
  {
    regex: /MetaManager\.getInstance\(/g,
    replace: 'new MetaManager('
  },
  // 5. Fix InputDispatcher.getInstance call
  {
    regex: /InputDispatcher\.getInstance\(\)/g,
    replace: 'new InputDispatcher()'
  },
  // 6. Fix broken CampaignManager constructor calls from previous partial patch
  {
    regex: /new CampaignManager\(,/g,
    replace: 'new CampaignManager(new MockStorageProvider(),'
  }
];

walk('tests', (filePath) => {
  if (filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = content;
    
    for (const p of patterns) {
      updated = updated.replace(p.regex, p.replace);
    }
    
    // Fix broken imports from previous run
    updated = updated.replace(/import \{ CampaignManager \} import \{ MetaManager \}/g, 'import { CampaignManager } from "@src/renderer/campaign/CampaignManager";\nimport { MetaManager } from "@src/renderer/campaign/MetaManager";');
    updated = updated.replace(/import \{ CampaignManager \}\s+import \{ MetaManager \}/g, 'import { CampaignManager } from "@src/renderer/campaign/CampaignManager";\nimport { MetaManager } from "@src/renderer/campaign/MetaManager";');

    // Add missing imports properly
    if (updated.includes('new MetaManager(') && !updated.includes('import { MetaManager }')) {
        console.log('Adding MetaManager import to ' + filePath);
        if (updated.includes('import { CampaignManager } from "@src/renderer/campaign/CampaignManager";')) {
            updated = updated.replace('import { CampaignManager } from "@src/renderer/campaign/CampaignManager";', 'import { CampaignManager } from "@src/renderer/campaign/CampaignManager";\nimport { MetaManager } from "@src/renderer/campaign/MetaManager";');
        } else if (updated.includes('import { CampaignManager } from "@src/engine/managers/CampaignManager";')) {
            updated = updated.replace('import { CampaignManager } from "@src/engine/managers/CampaignManager";', 'import { CampaignManager } from "@src/engine/managers/CampaignManager";\nimport { MetaManager } from "@src/engine/campaign/MetaManager";');
        } else {
            updated = 'import { MetaManager } from "@src/engine/campaign/MetaManager";\n' + updated;
        }
    }
    
    if (updated.includes('new MockStorageProvider(') && !updated.includes('import { MockStorageProvider }')) {
        console.log('Adding MockStorageProvider import to ' + filePath);
        updated = 'import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";\n' + updated;
    }

    if (updated !== content) {
      console.log('Updating ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
  }
});
