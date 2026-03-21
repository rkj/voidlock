import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function getFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.resolve(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allTestFiles = getFiles(path.join(projectRoot, 'tests'));

const implementation = `startNewCampaign: vi.fn((seed, diff, overrides) => {
        currentCampaignState = {
            status: "Active",
            nodes: [
                {
                    id: "node-1",
                    type: "Combat",
                    status: "Accessible",
                    rank: 0,
                    difficulty: 1,
                    mapSeed: 123,
                    connections: [],
                    position: { x: 0, y: 0 },
                    bonusLootCount: 0,
                },
            ],
            roster: [
                {
                    id: "s1",
                    name: "Soldier 1",
                    archetypeId: "scout",
                    status: "Healthy",
                    level: 1,
                    hp: 100,
                    maxHp: 100,
                    xp: 0,
                    kills: 0,
                    missions: 0,
                    recoveryTime: 0,
                    soldierAim: 80,
                    equipment: {
                        rightHand: "pulse_rifle",
                        leftHand: undefined,
                        body: "basic_armor",
                        feet: undefined,
                    },
                },
            ],
            scrap: 100,
            intel: 0,
            currentSector: 1,
            currentNodeId: null,
            history: [],
            unlockedArchetypes: ["scout", "heavy", "medic", "demolition"],
            rules: {
                mode: "Preset",
                difficulty: diff || "Standard",
                deathRule: "Simulation",
                allowTacticalPause: true,
                mapGeneratorType: "DenseShip",
                difficultyScaling: 1,
                resourceScarcity: 1,
                startingScrap: 100,
                mapGrowthRate: 1,
                baseEnemyCount: 3,
                enemyGrowthPerMission: 1,
                economyMode: "Open",
                themeId: "default",
            },
        };
    }),`;

allTestFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (content.includes('vi.mock("@src/renderer/campaign/CampaignManager"') && content.includes('startNewCampaign: vi.fn(),')) {
      content = content.replace('startNewCampaign: vi.fn(),', implementation);
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  }
});

console.log("CampaignManager mock startNewCampaign fix complete.");
