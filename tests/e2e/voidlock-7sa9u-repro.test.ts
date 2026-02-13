import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-7sa9u repro: X button focus", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should ensure the 'Remove' X button is not focusable via keyboard navigation", async () => {
    // 1. Setup mock state with soldiers in roster
    const mockState = {
      version: "1.0",
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
      scrap: 1000,
      intel: 50,
      currentSector: 1,
      currentNodeId: null,
      nodes: [],
      roster: [
        {
          id: "s1",
          name: "Sgt. Repro",
          archetypeId: "assault",
          hp: 100,
          maxHp: 100,
          soldierAim: 80,
          status: "Healthy",
          xp: 0,
          level: 1,
          kills: 0,
          missions: 0,
          equipment: { rightHand: "pulse_rifle", leftHand: "combat_knife" },
          recoveryTime: 0
        },
        {
          id: "s2",
          name: "Cpl. Focus",
          archetypeId: "medic",
          hp: 100,
          maxHp: 100,
          soldierAim: 70,
          status: "Healthy",
          xp: 0,
          level: 1,
          kills: 0,
          missions: 0,
          equipment: { rightHand: "pistol", leftHand: "medkit" },
          recoveryTime: 0
        }
      ],
      history: [],
      unlockedArchetypes: ["assault", "medic"],
      unlockedItems: []
    };

    const mockConfig = {
      mapWidth: 10,
      mapHeight: 10,
      spawnPointCount: 3,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      agentControlEnabled: true,
      allowTacticalPause: true,
      mapGeneratorType: 'DenseShip',
      missionType: 'Default',
      lastSeed: 12345,
      startingThreatLevel: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      bonusLootCount: 0,
      debugSnapshotInterval: 0,
      manualDeployment: true,
      squadConfig: {
        soldiers: [],
        inventory: { medkit: 1, frag_grenade: 2 }
      }
    };

    await page.goto(E2E_URL);
    await page.evaluate((state, config) => {
      localStorage.setItem('voidlock_campaign_v1', JSON.stringify(state));
      localStorage.setItem('voidlock_global_config', JSON.stringify({
        unitStyle: 'TacticalIcons',
        themeId: 'default',
        logLevel: 'INFO',
        debugSnapshots: false,
        debugSnapshotInterval: 0,
        debugOverlayEnabled: false,
        cloudSyncEnabled: false
      }));
      localStorage.setItem('voidlock_campaign_config', JSON.stringify(config));
    }, mockState, mockConfig);

    // 2. Go to mission setup
    console.log("Navigating to #mission-setup...");
    await page.goto(E2E_URL + "#mission-setup");
    await page.reload();
    
    try {
        await page.waitForSelector("#screen-mission-setup", { visible: true, timeout: 10000 });
        await page.waitForSelector(".roster-list", { visible: true, timeout: 5000 });
    } catch (e) {
        console.log("FAILED to find Mission Setup or Roster List.");
        const currentUrl = await page.url();
        console.log("Current URL:", currentUrl);
        const visibleScreens = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.screen'))
                .filter(el => (el as HTMLElement).style.display !== 'none')
                .map(el => el.id);
        });
        console.log("Visible screens:", visibleScreens);
        await page.screenshot({ path: "tests/e2e/__snapshots__/debug_mission_setup_fail.png" });
        throw e;
    }

    // 3. Deploy the soldier
    await page.waitForSelector(".roster-list .soldier-card");
    await page.click(".roster-list .soldier-card");
    await page.waitForSelector(".deployment-slot.ready-for-placement");
    await page.click(".deployment-slot.ready-for-placement");
    await page.waitForSelector(".deployment-slot.occupied");
    
    // 4. Check if slot-remove is focusable
    const isRemoveButtonFocusable = await page.evaluate(() => {
      const removeBtn = document.querySelector(".slot-remove");
      if (!removeBtn) return "NOT_FOUND";
      
      const container = document.getElementById("screen-mission-setup");
      if (!container) return "CONTAINER_NOT_FOUND";
      
      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
      );
      
      return focusableElements.includes(removeBtn as HTMLElement);
    });

    console.log("Is Remove Button Focusable:", isRemoveButtonFocusable);
    expect(isRemoveButtonFocusable).toBe(false);
  });
});
