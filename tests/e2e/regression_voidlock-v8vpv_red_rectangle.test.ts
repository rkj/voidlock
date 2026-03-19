import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Red Rectangle (Terminal Offline) Regression (voidlock-v8vpv)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', error => console.log(`BROWSER ERROR: ${error.message}`));
    await page.setViewport({ width: 1920, height: 1080 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should display Terminal Offline warning with readable text, not a solid red block", async () => {
    // 1. Inject a campaign state where prologue is done (Mission 1 complete)
    const mockState = {
      version: "1.0.0",
      saveVersion: 1,
      seed: 123,
      status: "Active",
      scrap: 500,
      intel: 10,
      currentSector: 1,
      currentNodeId: "node-1",
      nodes: [
        {
          id: "node-1",
          type: "Combat",
          status: "Cleared",
          rank: 0,
          difficulty: 1,
          mapSeed: 123,
          connections: ["node-2"],
          position: { x: 0, y: 0 },
          bonusLootCount: 0,
        },
        {
          id: "node-2",
          type: "Combat",
          status: "Accessible",
          rank: 1,
          difficulty: 1,
          mapSeed: 456,
          connections: [],
          position: { x: 10, y: 10 },
          bonusLootCount: 0,
        }
      ],
      roster: [
        {
          id: "s1",
          name: "Soldier 1",
          archetypeId: "assault",
          hp: 100,
          maxHp: 100,
          soldierAim: 80,
          xp: 150,
          level: 2,
          kills: 5,
          missions: 1,
          status: "Healthy",
          equipment: { rightHand: "pulse_rifle" },
        }
      ],
      history: [
        { 
          nodeId: "node-1", 
          seed: 123,
          result: "Won", 
          aliensKilled: 10,
          scrapGained: 100,
          intelGained: 5,
          timeSpent: 60000,
          soldierResults: [] 
        }
      ],
      rules: {
        mode: "Preset",
        difficulty: "Standard",
        deathRule: "Iron",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        difficultyScaling: 1.5,
        resourceScarcity: 0.7,
        startingScrap: 300,
        mapGrowthRate: 0.5,
        baseEnemyCount: 4,
        enemyGrowthPerMission: 1.5,
        economyMode: "Open",
        skipPrologue: false,
      },
      unlockedArchetypes: ["assault"],
      unlockedItems: ["pistol", "pulse_rifle"],
    };

    await page.goto(E2E_URL, { waitUntil: "load" });

    // Inject state into local storage
    await page.evaluate((state) => {
        localStorage.setItem("voidlock_campaign_v1", JSON.stringify(state));
        // Ensure tutorial is active but Mission 1 is done
        localStorage.removeItem("voidlock_tutorial_state");
    }, mockState);

    // Reload page to apply injected state
    await page.goto(E2E_URL, { waitUntil: "load" });
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 15000 });

    // Click Active Contracts to launch the campaign mode
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // The Tutorial Manager should show the Ready Room advisor message since Mission 1 is done
    await page.waitForSelector(".advisor-narrative-modal button", { visible: true, timeout: 5000 }).catch(() => {});
    
    // Dismiss Advisor
    await page.waitForSelector(".advisor-btn[data-id='dismiss']", { visible: true, timeout: 5000 }).catch(() => {});
    await page.evaluate(() => {
        const btn = document.querySelector(".advisor-btn[data-id='dismiss']") as HTMLElement;
        if (btn) btn.click();
    });

    // Because Mission 1 is done and tutorial is active, the app automatically navigates to the Equipment Screen (Ready Room intro)
    await page.waitForSelector("#screen-equipment", { visible: true });

    // Wait for the Terminal Offline message
    await page.waitForSelector(".dead-warning", { visible: true });
    
    // Check that there is no inline background color overriding the text
    const hasRedBackground = await page.evaluate(() => {
        const warning = document.querySelector(".dead-warning") as HTMLElement;
        return warning.style.background === "var(--color-danger)" || warning.style.backgroundColor === "rgb(255, 68, 68)";
    });

    expect(hasRedBackground).toBe(false);

    await page.screenshot({ path: "tests/e2e/__snapshots__/voidlock-v8vpv_dead_warning.png" });
  });
});
