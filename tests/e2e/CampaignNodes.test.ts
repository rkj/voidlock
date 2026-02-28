import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Campaign Node Special Types", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    page.on("console", msg => console.log("BROWSER:", msg.text()));
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should open the Shop UI (Equipment Screen) when a Shop node is selected", async () => {
    await page.goto(E2E_URL);
    
    // Mock Campaign State with a Shop node
    const mockState = {
      version: "0.141.3",
      saveVersion: 1,
      seed: 123,
      status: "Active",
      rules: {
        mode: "Custom",
        difficulty: "Clone",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        difficultyScaling: 1,
        resourceScarcity: 1,
        startingScrap: 500,
        mapGrowthRate: 1,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        economyMode: "Open",
        skipPrologue: true
      },
      scrap: 500,
      intel: 0,
      currentSector: 1,
      currentNodeId: "node-0",
      nodes: [
        {
          id: "node-0",
          type: "Combat",
          status: "Cleared",
          difficulty: 1,
          rank: 0,
          mapSeed: 123,
          connections: ["node-shop"],
          position: { x: 0, y: 0 },
          bonusLootCount: 0
        },
        {
          id: "node-shop",
          type: "Shop",
          status: "Accessible",
          difficulty: 1,
          rank: 1,
          mapSeed: 124,
          connections: [],
          position: { x: 100, y: 0 },
          bonusLootCount: 0
        }
      ],
      roster: [
          {
              id: "soldier-1",
              name: "Test Soldier",
              archetypeId: "assault",
              hp: 100,
              maxHp: 100,
              status: "Healthy",
              xp: 0,
              level: 1,
              equipment: {
                  rightHand: "pistol",
                  leftHand: undefined,
                  body: "armor_light",
                  feet: "boots_speed"
              },
              soldierAim: 65,
              kills: 0,
              missions: 0
          }
      ],
      history: [],
      unlockedArchetypes: ["assault"],
      unlockedItems: []
    };

    await page.evaluate((state) => {
      localStorage.clear();
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
      window.location.hash = "#campaign";
    }, mockState);

    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector('.campaign-node[data-id="node-shop"]', { visible: true, timeout: 15000 });

    // Click the shop node
    await page.click('.campaign-node[data-id="node-shop"]');

    // Should open Equipment Screen
    await page.waitForSelector('#screen-equipment', { visible: true });

    // Expect "Leave Shop" (correct behavior)
    // BUG: It currently shows "Back" instead of "Leave Shop"
    const confirmBtnText = await page.evaluate(() => {
        const btn = document.querySelector('[data-focus-id="btn-back"]');
        return btn ? btn.textContent?.trim() : null;
    });
    
    expect(confirmBtnText).toBe("Leave Shop");
  });

  it("should NOT list optional Recover objectives as primary in Default mission", async () => {
    await page.goto(E2E_URL);
    
    const mockState = {
      version: "0.141.3",
      saveVersion: 1,
      seed: 123,
      status: "Active",
      rules: {
        mode: "Custom",
        difficulty: "Clone",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        difficultyScaling: 1,
        resourceScarcity: 1,
        startingScrap: 500,
        mapGrowthRate: 1,
        baseEnemyCount: 1,
        enemyGrowthPerMission: 1,
        economyMode: "Open",
        skipPrologue: true
      },
      scrap: 500,
      intel: 0,
      currentSector: 1,
      currentNodeId: "node-0",
      nodes: [
        {
          id: "node-0",
          type: "Combat",
          status: "Cleared",
          difficulty: 1,
          rank: 0,
          mapSeed: 123,
          connections: ["node-combat"],
          position: { x: 0, y: 0 },
          bonusLootCount: 0
        },
        {
          id: "node-combat",
          type: "Combat",
          status: "Accessible",
          difficulty: 1,
          rank: 1,
          mapSeed: 124,
          connections: [],
          position: { x: 100, y: 0 },
          bonusLootCount: 0
        }
      ],
      roster: [
          {
              id: "soldier-1",
              name: "Test Soldier",
              archetypeId: "assault",
              hp: 1000, 
              maxHp: 1000,
              status: "Healthy",
              xp: 0,
              level: 1,
              equipment: {
                  rightHand: "pistol",
                  leftHand: undefined,
                  body: "armor_light",
                  feet: "boots_speed"
              },
              soldierAim: 65,
              kills: 0,
              missions: 0
          }
      ],
      history: [],
      unlockedArchetypes: ["assault"],
      unlockedItems: []
    };

    await page.evaluate((state) => {
      localStorage.clear();
      localStorage.setItem("voidlock_campaign_v1", JSON.stringify(state));
      // Use defaults but ensure large map
      localStorage.setItem("voidlock_campaign_config", JSON.stringify({
          mapWidth: 20,
          mapHeight: 20,
          spawnPointCount: 1,
          fogOfWarEnabled: false,
          debugOverlayEnabled: true,
          losOverlayEnabled: false,
          agentControlEnabled: true,
          allowTacticalPause: true,
          mapGeneratorType: "DenseShip",
          missionType: "Default",
          lastSeed: 124,
          startingThreatLevel: 0,
          baseEnemyCount: 1,
          enemyGrowthPerMission: 1,
          bonusLootCount: 0,
          debugSnapshotInterval: 0,
          manualDeployment: true,
          squadConfig: { soldiers: [], inventory: {} }
      }));
      window.location.hash = "#campaign";
    }, mockState);

    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector('.campaign-node[data-id="node-combat"]', { visible: true });

    // Click the combat node
    await page.click('.campaign-node[data-id="node-combat"]');

    // Should open Equipment Screen
    await page.waitForSelector('#screen-equipment', { visible: true });

    // Wait for roster picker
    await page.waitForFunction(() => {
        const panel = document.querySelector('.armory-panel');
        return panel && panel.querySelectorAll('.soldier-widget-roster').length > 0;
    }, { timeout: 10000 });

    // Click the soldier
    await page.click('.armory-panel .soldier-widget-roster');
    
    // Click Launch Mission
    await page.waitForSelector('[data-focus-id="btn-launch-mission"]:not([disabled])', { visible: true });
    await page.click('[data-focus-id="btn-launch-mission"]');

    // Wait for mission screen
    await page.waitForSelector('#screen-mission', { visible: true, timeout: 60000 });
    
    // Handle Deployment
    await page.waitForSelector('#btn-autofill-deployment', { visible: true });
    await page.click('#btn-autofill-deployment');
    await page.waitForSelector('#btn-start-mission:not([disabled])', { visible: true });
    await page.click('#btn-start-mission');

    // Wait for Objective List
    // Selector confirmed in HUDManager.ts: .obj-row
    await page.waitForSelector('.obj-row', { timeout: 15000 });

    // Verify objectives
    const objectiveTexts = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.obj-text'));
        return items.map(i => i.textContent?.toLowerCase() || "");
    });

    // BUG: It SHOULD NOT contain "recover" but it DOES because of the bug
    const hasRecover = objectiveTexts.some(t => t.includes("recover") || t.includes("artifact") || t.includes("intel") || t.includes("crate"));
    
    expect(hasRecover).toBe(false);
  });
});
