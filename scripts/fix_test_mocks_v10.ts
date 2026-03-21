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

const assetManagerMockNew = `vi.mock("@src/renderer/visuals/AssetManager", () => {
  const mockInstance = {
    loadSprites: vi.fn(),
    getUnitSprite: vi.fn(),
    getEnemySprite: vi.fn(),
    getMiscSprite: vi.fn(),
    getIcon: vi.fn(),
  };
  return {
    AssetManager: vi.fn().mockImplementation(() => mockInstance),
  };
});`;

const campaignManagerMockNew = `vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn(() => typeof currentCampaignState !== 'undefined' ? currentCampaignState : null),
    getStorage: vi.fn().mockReturnValue({
        getCloudSync: vi.fn().mockReturnValue({
            initialize: vi.fn().mockResolvedValue(undefined),
            setEnabled: vi.fn(),
        }),
        load: vi.fn(),
    }),
    getSyncStatus: vi.fn().mockReturnValue("local-only"),
    addChangeListener: vi.fn(),
    removeChangeListener: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    assignEquipment: vi.fn(),
    processMissionResult: vi.fn(),
    startNewCampaign: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    CampaignManager: mockConstructor,
  };
});`;

allTestFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (content.includes('AssetManager') && content.includes('vi.mock')) {
      if (content.includes('AssetManager: {') || content.includes('AssetManager: vi.fn()')) {
          const match = content.match(/vi\.mock\("@src\/renderer\/visuals\/AssetManager"[\s\S]*?\}\);/);
          if (match) {
              content = content.replace(match[0], assetManagerMockNew);
              changed = true;
          }
      }
  }

  if (content.includes('CampaignManager') && content.includes('vi.mock')) {
      if (content.includes('CampaignManager: {') || content.includes('CampaignManager: vi.fn()')) {
          const match = content.match(/vi\.mock\("@src\/renderer\/campaign\/CampaignManager"[\s\S]*?\}\);/);
          if (match) {
              content = content.replace(match[0], campaignManagerMockNew);
              changed = true;
          }
      }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated mocks in: ${filePath}`);
  }
});
