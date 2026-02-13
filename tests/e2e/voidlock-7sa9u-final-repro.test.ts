import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-7sa9u repro: X button focus in Mission Setup", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should ensure the 'Remove' X button is not focusable via arrow navigation", async () => {
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
        }
      ],
      history: [],
      unlockedArchetypes: ["assault"],
      unlockedItems: []
    };

    await page.goto(E2E_URL);
    await page.evaluate((state) => {
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
    }, mockState);

    console.log("Navigating to #mission-setup...");
    await page.goto(E2E_URL + "#mission-setup");
    await page.reload();
    
    await page.waitForSelector("#screen-mission-setup", { visible: true, timeout: 10000 });
    
    // Deploy soldier
    await page.waitForSelector(".roster-list .soldier-card");
    await page.click(".roster-list .soldier-card");
    await page.waitForSelector(".deployment-slot.ready-for-placement");
    await page.click(".deployment-slot.ready-for-placement");
    await page.waitForSelector(".deployment-slot.occupied");

    // Check if slot-remove is in focusable elements
    const focusableData = await page.evaluate(() => {
      const container = document.getElementById("screen-mission-setup");
      if (!container) return { error: "CONTAINER_NOT_FOUND" };
      
      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
      );
      
      const removeBtn = container.querySelector(".slot-remove");
      
      return {
        isRemoveFocusable: focusableElements.includes(removeBtn as HTMLElement),
        removeBtnTag: removeBtn?.tagName,
        removeBtnTabIndex: removeBtn?.getAttribute('tabindex'),
        focusableCount: focusableElements.length
      };
    });

    console.log("Focusable Data:", focusableData);
    
    // If it's not focusable, the test might pass but we want to be sure about ARROW navigation too.
    // If it's a child of a focusable element, it shouldn't be focused by arrow navigation 
    // because handleArrowNavigation ONLY focuses elements from the focusableElements list.

    expect(focusableData.isRemoveFocusable).toBe(false);
  });
});
