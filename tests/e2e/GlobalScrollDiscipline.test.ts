import { describe, it, afterAll, beforeAll, expect } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Global Scroll Discipline", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should not allow scrolling the main window", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for the main menu to be visible
    await page.waitForSelector("#btn-menu-campaign", { visible: true });

    // Force a large height on an element to potentially cause a scrollbar if body didn't have overflow: hidden
    await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.style.height = '2000px';
        spacer.style.width = '100px';
        spacer.style.background = 'red';
        spacer.id = 'scroll-spacer';
        document.body.appendChild(spacer);
    });

    // Attempt to scroll the window
    await page.evaluate(() => {
      window.scrollTo(0, 1000);
    });

    // Verify window.scrollY is still 0
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);

    // Cleanup spacer
    await page.evaluate(() => {
        const spacer = document.getElementById('scroll-spacer');
        if (spacer) spacer.remove();
    });
  });

  it("Settings menu should have internal scrolling if content overflows", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-settings", { visible: true });
    await page.click("#btn-menu-settings");

    await page.waitForSelector("#screen-settings", { visible: true });

    // Check if the settings content container is scrollable
    await page.setViewport({ width: 1024, height: 400 });

    const scrollMetrics = await page.evaluate(() => {
        const container = document.querySelector("#screen-settings .settings-content");
        if (!container) return { error: "No settings content container found" };
        
        return {
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            overflowY: window.getComputedStyle(container).overflowY
        };
    });

    expect(scrollMetrics.overflowY).toBe("auto");
    await page.setViewport({ width: 1024, height: 768 });
  });

  it("Mission Setup should have internal scrolling and fixed footer", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");

    await page.waitForSelector("#screen-mission-setup", { visible: true });

    // Resize to small height to force scroll
    await page.setViewport({ width: 1024, height: 400 });

    const setupMetrics = await page.evaluate(() => {
        const container = document.querySelector("#setup-content");
        const footer = document.querySelector(".mission-setup-footer");
        if (!container || !footer) return { error: "Missing container or footer" };
        
        const footerStyle = window.getComputedStyle(footer);
        
        return {
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            isScrollable: container.scrollHeight > container.clientHeight,
            overflowY: window.getComputedStyle(container).overflowY,
            footerVisible: footerStyle.display !== 'none',
            footerIsFixed: footerStyle.flexShrink === '0'
        };
    });

    console.log("Mission Setup Metrics:", setupMetrics);
    
    expect(setupMetrics.overflowY).toBe("auto");
    expect(setupMetrics.isScrollable).toBe(true);
    expect(setupMetrics.footerVisible).toBe(true);
    expect(setupMetrics.footerIsFixed).toBe(true);
    
    await page.setViewport({ width: 1024, height: 768 });
  });

  it("Campaign Summary should have internal scrolling and fixed footer", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    
    const currentVersion = "0.138.3";
    console.log("Mocking version:", currentVersion);

    // Mock a victory state matching CampaignStateSchema
    await page.evaluate((version) => {
      const mockState = {
        version: version,
        saveVersion: 1,
        seed: 12345,
        status: "Victory",
        currentSector: 3,
        currentNodeId: "node-1",
        scrap: 500,
        intel: 50,
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
          economyMode: "Open"
        },
        nodes: [
          {
            id: "node-1",
            type: "Combat",
            status: "Cleared",
            difficulty: 1,
            rank: 0,
            mapSeed: 123,
            connections: [],
            position: { x: 0, y: 0 }
          }
        ],
        roster: Array(15).fill(null).map((_, i) => ({
          id: `s${i}`,
          name: `Soldier ${i}`,
          archetypeId: "scout",
          hp: 100,
          maxHp: 100,
          soldierAim: 60,
          xp: 100,
          level: 1,
          kills: 5,
          missions: 2,
          status: "Healthy",
          equipment: {},
          recoveryTime: 0
        })),
        history: Array(20).fill(null).map((_, i) => ({
          nodeId: `node-${i}`,
          seed: 123 + i,
          result: "Won",
          aliensKilled: 10,
          scrapGained: 50,
          intelGained: 5,
          timeSpent: 100,
          soldierResults: []
        })),
        unlockedArchetypes: ["assault", "medic", "scout"],
        unlockedItems: []
      };
      
      localStorage.setItem("voidlock_campaign_v1", JSON.stringify(mockState));
      console.log("Mocked state version:", version);
    }, currentVersion);

    // Verify localStorage
    const lsValue = await page.evaluate(() => localStorage.getItem("voidlock_campaign_v1"));
    console.log("LocalStorage value length:", lsValue?.length);

    // Use goto with hash and wait for it to be ready
    console.log("Navigating to #campaign-summary");
    // Force navigation and reload with hash to ensure app initializes with correct state
    await page.evaluate(() => {
        window.location.href = window.location.origin + "/#campaign-summary";
        window.location.reload();
    });
    
    // Wait for the screen to appear
    await page.waitForSelector("#screen-campaign-summary", { visible: true, timeout: 10000 }).catch(async (e) => {
        const bodyHtml = await page.evaluate(() => document.body.innerHTML);
        console.log("Body HTML snippet:", bodyHtml.substring(0, 1000));
        const visibleScreens = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.screen'))
                .filter(el => (el as HTMLElement).style.display !== 'none')
                .map(el => el.id);
        });
        console.log("Visible screens:", visibleScreens);
        throw e;
    });

    // Resize to small height to force scroll
    await page.setViewport({ width: 1024, height: 400 });

    const summaryMetrics = await page.evaluate(() => {
        const container = document.querySelector("#screen-campaign-summary .scroll-content");
        const footer = document.querySelector("#screen-campaign-summary .summary-footer");
        if (!container || !footer) {
            const containerHtml = document.getElementById("screen-campaign-summary")?.innerHTML;
            return { error: "Missing container or footer", html: containerHtml };
        }
        
        const footerStyle = window.getComputedStyle(footer);
        
        return {
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            isScrollable: container.scrollHeight > container.clientHeight,
            overflowY: window.getComputedStyle(container).overflowY,
            footerVisible: footerStyle.display !== 'none',
            footerIsFixed: footerStyle.flexShrink === '0'
        };
    });

    console.log("Campaign Summary Metrics:", summaryMetrics);
    
    expect(summaryMetrics.overflowY).toBe("auto");
    expect(summaryMetrics.isScrollable).toBe(true);
    expect(summaryMetrics.footerVisible).toBe(true);
    expect(summaryMetrics.footerIsFixed).toBe(true);
    
    await page.setViewport({ width: 1024, height: 768 });
  });
});
