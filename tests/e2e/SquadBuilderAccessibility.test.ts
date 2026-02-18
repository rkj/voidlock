import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";
import pkg from "../../package.json";

describe("Squad Builder Accessibility", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  test("Remove button is skipped in tab order", async () => {
    await page.goto(E2E_URL);
    await page.evaluate((state) => {
      localStorage.setItem("voidlock_campaign_v1", JSON.stringify(state));
      localStorage.setItem("voidlock_global_config", JSON.stringify({
        unitStyle: "TacticalIcons",
        themeId: "default",
        logLevel: "INFO",
        debugSnapshots: false,
        debugSnapshotInterval: 0,
        debugOverlayEnabled: false,
        cloudSyncEnabled: false
      }));
      // Also inject campaign config to ensure it loads in campaign mode
      localStorage.setItem("voidlock_campaign_config", JSON.stringify({
        mapWidth: 10,
        mapHeight: 10,
        spawnPointCount: 3,
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        losOverlayEnabled: false,
        agentControlEnabled: true,
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        missionType: "Default",
        lastSeed: 12345,
        startingThreatLevel: 0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        bonusLootCount: 0,
        debugSnapshotInterval: 0,
        manualDeployment: true,
        campaignNodeId: "node-1",
        squadConfig: {
          soldiers: [],
          inventory: { medkit: 1, frag_grenade: 2 }
        }
      }));
    }, {
      version: pkg.version,
      saveVersion: 1,
      seed: 12345,
      status: "Active",
      rules: {
        mode: "Preset",
        difficulty: "Standard",
        deathRule: "Iron",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        difficultyScaling: 1.0,
        resourceScarcity: 1.0,
        startingScrap: 500,
        mapGrowthRate: 1.0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1.0,
        economyMode: "Open",
      },
      scrap: 500,
      intel: 0,
      currentSector: 1,
      currentNodeId: "node-1",
      nodes: [
        {
          id: "node-1",
          type: "Combat",
          status: "Accessible",
          difficulty: 1,
          rank: 0,
          mapSeed: 123,
          connections: [],
          position: { x: 0, y: 0 },
          bonusLootCount: 0
        }
      ],
      roster: [
        {
          id: "soldier-1",
          name: "Soldier 1",
          archetypeId: "scout",
          hp: 100,
          maxHp: 100,
          soldierAim: 75,
          xp: 0,
          level: 1,
          kills: 0,
          missions: 0,
          status: "Healthy",
          equipment: {
            rightHand: "pistol",
            leftHand: "knife",
            body: "armor_vest",
            feet: "boots"
          },
          recoveryTime: 0
        }
      ],
      history: [],
      unlockedArchetypes: ["scout", "assault", "medic"],
      unlockedItems: []
    });
    
    // Refresh to apply localStorage and go to Mission Setup
    await page.goto(E2E_URL + "#mission-setup");
    await page.reload();

    // Wait for the soldier card to appear in the roster
    await page.waitForSelector('.roster-list .soldier-card[tabindex="0"]', { visible: true });

    // Focus on the first soldier card
    await page.focus('.roster-list .soldier-card[tabindex="0"]');
    
    // Press Tab twice. 
    // If 'Remove' button (x) is skipped, it should move to the next logical element (e.g. another card or #btn-goto-equipment).
    // In this specific test, we have one soldier in roster.
    // If we click to add it to squad, it moves to squad slot.
    
    // Add to squad first so there is a remove button
    await page.click('.roster-list .soldier-card');
    await page.waitForSelector('.squad-builder-container .slot-remove');

    // Focus on the soldier in the squad slot
    await page.waitForSelector('.deployment-slot.occupied');
    await page.focus('.deployment-slot.occupied');

    // Press Tab. It should NOT land on '.slot-remove' because it should have tabindex="-1"
    await page.keyboard.press("Tab");

    const activeElementClass = await page.evaluate(() => document.activeElement?.className);
    console.log("Active element class after Tab from squad slot:", activeElementClass);
    
    expect(activeElementClass).not.toBe("slot-remove");
  });
});
