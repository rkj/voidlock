import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-7sa9u fixed repro: X button focus in Equipment", () => {
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
    const mockGlobalConfig = {
      unitStyle: 'TacticalIcons',
      themeId: 'default',
      logLevel: 'INFO',
      debugSnapshots: false,
      debugSnapshotInterval: 0,
      debugOverlayEnabled: false,
      cloudSyncEnabled: false
    };

    const mockCustomConfig = {
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
        soldiers: [
          { archetypeId: "assault", name: "Sgt. Focus" }
        ],
        inventory: { medkit: 1, frag_grenade: 2 }
      }
    };

    await page.goto(E2E_URL);
    await page.evaluate((global, custom) => {
      localStorage.setItem('voidlock_global_config', JSON.stringify(global));
      localStorage.setItem('voidlock_custom_config', JSON.stringify(custom));
      localStorage.removeItem('voidlock_campaign_v1');
      localStorage.removeItem('voidlock_campaign_config');
    }, mockGlobalConfig, mockCustomConfig);

    console.log("Navigating to #equipment...");
    await page.goto(E2E_URL + "#equipment");
    await page.reload();
    
    await page.waitForSelector("#screen-equipment", { visible: true, timeout: 10000 });
    await page.waitForSelector(".soldier-list-panel .soldier-item", { visible: true, timeout: 10000 });

    // 1. Check if slot-remove is in focusable elements
    const focusableData = await page.evaluate(() => {
      const container = document.getElementById("screen-equipment");
      if (!container) return { error: "CONTAINER_NOT_FOUND" };
      
      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([tabindex="-1"]), select:not([tabindex="-1"]), textarea:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
        )
      );
      
      const removeBtn = container.querySelector(".slot-remove");
      const firstCard = container.querySelector(".soldier-item");
      
      return {
        isRemoveFocusable: focusableElements.includes(removeBtn as HTMLElement),
        removeBtnTag: removeBtn?.tagName,
        removeBtnClassName: removeBtn?.className,
        firstCardTabIndex: firstCard?.tabIndex,
      };
    });

    console.log("Focusable Data:", focusableData);
    
    // 2. Perform ArrowRight from first card
    console.log("Testing ArrowRight from first card...");
    const arrowResult = await page.evaluate(() => {
      const container = document.getElementById("screen-equipment");
      const firstCard = container?.querySelector(".soldier-item") as HTMLElement;
      if (!firstCard) return "CARD_NOT_FOUND";
      
      firstCard.focus();
      const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
      firstCard.dispatchEvent(event);
      
      const focused = document.activeElement;
      return {
        focusedTag: focused?.tagName,
        focusedClassName: focused?.className,
        isRemoveFocused: focused?.classList.contains("slot-remove"),
      };
    });
    
    console.log("Arrow Result:", arrowResult);
    
    expect(focusableData.isRemoveFocusable).toBe(false);
    if (typeof arrowResult === 'object') {
        expect(arrowResult.isRemoveFocused).toBe(false);
    }
  });
});
