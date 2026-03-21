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

const metaManagerMockNew = `vi.mock("@src/renderer/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 0,
      totalCampaignsStarted: 0,
      campaignsWon: 0,
      campaignsLost: 0,
      totalMissionsWon: 0,
      totalMissionsPlayed: 0,
      totalCasualties: 0,
      totalScrapEarned: 0,
      currentIntel: 0,
      unlockedArchetypes: [],
      unlockedItems: [],
      prologueCompleted: false,
    }),
    load: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { MetaManager: mockConstructor };
});`;

allTestFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (content.includes('MetaManager') && content.includes('vi.mock')) {
      const match = content.match(/vi\.mock\("@src\/renderer\/campaign\/MetaManager"[\s\S]*?\}\);/);
      if (match) {
          content = content.replace(match[0], metaManagerMockNew);
          changed = true;
      }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated MetaManager mock in: ${filePath}`);
  }
});
