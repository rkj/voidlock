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

const mockFixes = [
  // Fix vi.mock for CampaignManager to return a constructor
  {
    regex: /vi\.mock\("@src\/renderer\/campaign\/CampaignManager", \(\) => \{\s+const mockInstance = \{[^}]+\};\s+return \{\s+CampaignManager: \{\s+resetInstance: vi\.fn\(\),\s+\}\s+\};\s+\}\);/gs,
    replace: (match) => {
        const instanceMatch = match.match(/const mockInstance = (\{[^}]+\});/s);
        if (instanceMatch) {
            return `vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = ${instanceMatch[1]};
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  return { CampaignManager: mockConstructor };
});`;
        }
        return match;
    }
  }
];

walk('tests', (filePath) => {
  if (filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = content;
    
    for (const p of patterns) {
      updated = updated.replace(p.regex, p.replace);
    }
    
    for (const mf of mockFixes) {
        updated = updated.replace(mf.regex, mf.replace);
    }
    
    // Add missing imports if needed
    if (updated.includes('new MetaManager(') && !updated.includes('import { MetaManager }')) {
        console.log('Adding MetaManager import to ' + filePath);
        updated = updated.replace(/import \{ CampaignManager \}/, 'import { CampaignManager }\nimport { MetaManager }');
    }
    if (updated.includes('new MockStorageProvider(') && !updated.includes('import { MockStorageProvider }')) {
        console.log('Adding MockStorageProvider import to ' + filePath);
        updated = updated.replace(/import \{ MetaManager \}/, 'import { MetaManager }\nimport { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";');
    }

    if (updated !== content) {
      console.log('Updating ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
  }
});
