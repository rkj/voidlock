import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

const themeManagerMockOld = /vi\.mock\("@src\/renderer\/ThemeManager", \(\) => \(\{[\s\S]*?ThemeManager: \{[\s\S]*?getInstance:[\s\S]*?\},[\s\S]*?\}\)\);/g;
const themeManagerMockNew = `vi.mock("@src/renderer/ThemeManager", () => {
  const mockInstance = {
    init: vi.fn().mockResolvedValue(undefined),
    setTheme: vi.fn(),
    getAssetUrl: vi.fn().mockReturnValue("mock-url"),
    getColor: vi.fn().mockReturnValue("#000"),
    getIconUrl: vi.fn().mockReturnValue("mock-icon-url"),
    getCurrentThemeId: vi.fn().mockReturnValue("default"),
    applyTheme: vi.fn(),
  };
  return {
    ThemeManager: vi.fn().mockImplementation(() => mockInstance),
  };
});`;

const assetManagerMockOld = /vi\.mock\("@src\/renderer\/visuals\/AssetManager", \(\) => \(\{[\s\S]*?AssetManager: \{[\s\S]*?getInstance:[\s\S]*?\},[\s\S]*?\}\)\);/g;
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

const campaignManagerMockOld = /vi\.mock\("@src\/renderer\/campaign\/CampaignManager", \(\) => \{[\s\S]*?return \{[\s\S]*?CampaignManager: \{[\s\S]*?getInstance: vi\.fn\(\)\.mockReturnValue\(\{[\s\S]*?\}\),[\s\S]*?\},[\s\S]*?\};[\s\S]*?\}\);/g;
const campaignManagerMockNew = `vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn(() => null),
    getStorage: vi.fn(),
    getSyncStatus: vi.fn().mockReturnValue("local-only"),
    addChangeListener: vi.fn(),
    removeChangeListener: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    assignEquipment: vi.fn(),
    processMissionResult: vi.fn(),
    startNewCampaign: vi.fn(),
  };
  return {
    CampaignManager: vi.fn().mockImplementation(() => mockInstance),
  };
});`;

allTestFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (content.includes('ThemeManager') && content.includes('vi.mock')) {
      // Try a simpler replace if regex is too strict
      if (content.includes('ThemeManager: {') && content.includes('getInstance:')) {
          // Find the whole vi.mock block for ThemeManager
          const match = content.match(/vi\.mock\("@src\/renderer\/ThemeManager"[\s\S]*?\}\);/);
          if (match) {
              content = content.replace(match[0], themeManagerMockNew);
              changed = true;
          }
      }
  }

  if (content.includes('AssetManager') && content.includes('vi.mock')) {
      if (content.includes('AssetManager: {') && content.includes('getInstance:')) {
          const match = content.match(/vi\.mock\("@src\/renderer\/visuals\/AssetManager"[\s\S]*?\}\);/);
          if (match) {
              content = content.replace(match[0], assetManagerMockNew);
              changed = true;
          }
      }
  }

  if (content.includes('CampaignManager') && content.includes('vi.mock')) {
      if (content.includes('CampaignManager: {') && content.includes('getInstance:')) {
          const match = content.match(/vi\.mock\("@src\/renderer\/campaign\/CampaignManager"[\s\S]*?\}\);/);
          if (match) {
              // Preserve some specific logic if it looks complicated, but for now just replace
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
