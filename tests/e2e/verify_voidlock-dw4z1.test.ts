import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Visual Verification: Terminal Offline Position", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show Terminal Offline message at the top of the right panel", async () => {
    await page.setViewport({ width: 1024, height: 768 });
    
    // 1. Initial load to set up domain
    await page.goto(E2E_URL);
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // 2. Setup Mission 2 state (Lockdown)
    await page.evaluate(() => {
      localStorage.clear();
      const mockCampaignState = {
        version: "1.0.0",
        saveVersion: 1,
        seed: 123,
        status: "Active",
        scrap: 500,
        intel: 10,
        currentSector: 1,
        currentNodeId: "node-2",
        nodes: [
          { id: "node-1", type: "Combat", status: "Cleared", rank: 0, difficulty: 1, mapSeed: 123, connections: ["node-2"], position: { x: 0, y: 0 }, bonusLootCount: 0 },
          { id: "node-2", type: "Combat", status: "Accessible", rank: 1, difficulty: 1, mapSeed: 456, connections: [], position: { x: 10, y: 10 }, bonusLootCount: 0 }
        ],
        roster: [{ id: "s1", name: "Soldier 1", archetypeId: "assault", hp: 100, maxHp: 100, soldierAim: 80, xp: 150, level: 2, kills: 5, missions: 1, status: "Healthy", equipment: { rightHand: "pistol" } }],
        history: [{ nodeId: "node-1", seed: 123, result: "Won", aliensKilled: 10, scrapGained: 100, intelGained: 5, timeSpent: 60000, soldierResults: [] }],
        rules: { mode: "Preset", difficulty: "Standard", deathRule: "Iron", allowTacticalPause: true, mapGeneratorType: "DenseShip", difficultyScaling: 1.5, resourceScarcity: 0.7, startingScrap: 300, mapGrowthRate: 0.5, baseEnemyCount: 4, enemyGrowthPerMission: 1.5, economyMode: "Open", skipPrologue: false },
        unlockedArchetypes: ["assault"],
        unlockedItems: ["pistol"],
      };

      const mockGameConfig = {
        mapWidth: 10,
        mapHeight: 10,
        spawnPointCount: 1,
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        losOverlayEnabled: false,
        agentControlEnabled: false,
        manualDeployment: false,
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        missionType: "Default",
        lastSeed: 456,
        squadConfig: { soldiers: [], inventory: {} },
        campaignNodeId: "node-2"
      };

      localStorage.setItem("voidlock_campaign_v1", JSON.stringify(mockCampaignState));
      localStorage.setItem("voidlock_campaign_config", JSON.stringify(mockGameConfig));
      localStorage.setItem("voidlock_session_state", JSON.stringify({ screenId: "equipment", isCampaign: true }));
    });

    // 3. Reload with the hash to navigate directly to Equipment screen
    await page.goto(E2E_URL + "#equipment");
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);
    
    // 4. Force lockdown state for visual verification
    await page.evaluate(() => {
      const app = (window as any).GameAppInstance;
      if (app && app.registry && app.registry.navigationOrchestrator) {
        const equipmentScreen = app.registry.navigationOrchestrator.screens.equipment;
        equipmentScreen.setStoreLocked(true);
        equipmentScreen.render();
      }
    });

    await page.waitForSelector(".locked-store-message", { visible: true, timeout: 5000 });
    await new Promise(r => setTimeout(r, 1000)); // Allow screen to render

    // 5. Take screenshot
    await page.screenshot({ path: "tests/e2e/screenshots/voidlock-dw4z1_fix_verification_desktop.png" });

    // 6. Verify position via script
    const isTop = await page.evaluate(() => {
      const panel = document.querySelector(".armory-panel .scroll-content");
      if (!panel) return false;
      const firstChild = panel.children[0];
      return firstChild && firstChild.classList.contains("locked-store-message");
    });

    expect(isTop).toBe(true);

    // 7. Mobile verification
    await page.setViewport({ width: 400, height: 800 });
    await new Promise(r => setTimeout(r, 1000)); // Wait for layout
    await page.screenshot({ path: "tests/e2e/screenshots/voidlock-dw4z1_fix_verification_mobile.png" });
  });
});
