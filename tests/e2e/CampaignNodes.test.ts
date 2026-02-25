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
      version: "0.139.6",
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
    await page.waitForSelector('.equipment-screen', { visible: true });

    // Verify button text is "Leave Shop"
    const confirmBtnText = await page.evaluate(() => {
        const btn = document.querySelector('[data-focus-id="btn-confirm-squad"]');
        return btn ? btn.textContent : null;
    });
    expect(confirmBtnText).toBe("Leave Shop");

    // Verify "Launch Mission" button is NOT present
    const launchBtn = await page.$('[data-focus-id="btn-launch-mission"]');
    expect(launchBtn).toBeNull();
    
    // Click Leave Shop
    await page.click('[data-focus-id="btn-confirm-squad"]');
    
    // Should return to Campaign Screen
    await page.waitForSelector('.campaign-screen', { visible: true });
    
    await page.screenshot({ path: "tests/e2e/__snapshots__/shop_node_exit.png" });
  });

  it("should NOT list optional Recover objectives as primary in DestroyHive mission", async () => {
    await page.goto(E2E_URL);
    
    // Mock Campaign State with a DestroyHive mission that has a map-defined objective
    // We'll use a static map with an objective
    const mockState = {
      version: "0.139.6",
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
          connections: ["node-hive"],
          position: { x: 0, y: 0 },
          bonusLootCount: 0
        },
        {
          id: "node-hive",
          type: "Combat",
          missionType: "DestroyHive",
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
      localStorage.setItem("voidlock_campaign_v1", JSON.stringify(state));
      window.location.hash = "#campaign";
    }, mockState);

    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector('.campaign-node[data-id="node-hive"]', { visible: true });

    // Click the hive node
    await page.click('.campaign-node[data-id="node-hive"]');

    // Should open Equipment Screen
    await page.waitForSelector('.equipment-screen', { visible: true });
    await page.screenshot({ path: "tests/e2e/__snapshots__/debug_equipment_hive.png" });

    // Click Launch Mission
    await page.waitForSelector('[data-focus-id="btn-launch-mission"]', { visible: true });
    await page.click('[data-focus-id="btn-launch-mission"]');

    // Wait for mission screen
    await page.screenshot({ path: "tests/e2e/__snapshots__/debug_after_launch_click.png" });
    await page.waitForSelector('#mission-ui', { visible: true, timeout: 60000 });
    
    // Auto-Fill Spawns and Start Mission if in deployment phase
    const deploymentVisible = await page.evaluate(() => {
        const el = document.querySelector('#deployment-overlay');
        return el && (el as HTMLElement).style.display !== 'none';
    });
    
    if (deploymentVisible) {
        await page.click('#btn-auto-fill-spawns');
        await page.click('#btn-start-mission');
    }

    // Wait for Objective List to populate
    await page.waitForSelector('.objective-item', { visible: true });

    // Verify objectives
    const objectiveTexts = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.objective-item'));
        return items.map(i => i.textContent?.toLowerCase() || "");
    });

    // Should contain "kill" or "hive"
    expect(objectiveTexts.some(t => t.includes("kill") || t.includes("hive"))).toBe(true);
    
    // Should NOT contain "recover" or "artifact" or "intel" 
    // (Unless it's a random objective from the map, but we want to ensure Recover objectives from map are excluded in non-Recover missions)
    // Wait, if it's a random map, it might have one.
    // My MissionManager fix ensures that obj.kind === "Recover" and !isRecoverMission are excluded.
    
    expect(objectiveTexts.every(t => !t.includes("recover") && !t.includes("artifact") && !t.includes("intel"))).toBe(true);

    await page.screenshot({ path: "tests/e2e/__snapshots__/mission_objectives_hive.png" });
  });
});
