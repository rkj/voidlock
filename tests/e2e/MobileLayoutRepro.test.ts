import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";
import { KnownDevices } from "puppeteer";

describe("Mobile Layout Regressions Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.emulate(KnownDevices["iPhone 12"]); // 390x844
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should check Statistics Screen for row clipping", async () => {
    await page.goto(E2E_URL + "#statistics", { waitUntil: "load" });
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);
    
    await page.waitForSelector("#screen-statistics");
    await page.waitForSelector(".scroll-content .flex-row");

    const clippingInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("#screen-statistics .flex-row.justify-between"));
      return rows.map(row => {
        const rect = row.getBoundingClientRect();
        const children = Array.from(row.children);
        let totalWidth = 0;
        children.forEach(child => {
            totalWidth += child.getBoundingClientRect().width;
        });
        
        // Add gap if we can find it
        const gap = parseInt(window.getComputedStyle(row).gap) || 0;
        const expectedMinWidth = totalWidth + (children.length - 1) * gap;

        return {
          text: row.textContent,
          rowWidth: rect.width,
          expectedMinWidth,
          isClipped: expectedMinWidth > rect.width + 1 // +1 for subpixel rounding
        };
      });
    });

    console.log("Stats Clipping Info:", JSON.stringify(clippingInfo, null, 2));
    const clippedRows = clippingInfo.filter(r => r.isClipped);
    expect(clippedRows.length, `Found ${clippedRows.length} clipped rows in Stats`).toBe(0);
  });

  it("should check Engineering Tab bar for clipping/wrapping", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => {
      localStorage.clear();
      const mockCampaignState = {
        version: "0.149.15",
        saveVersion: 1,
        seed: 123,
        status: "Active",
        scrap: 500,
        intel: 10,
        currentSector: 1,
        currentNodeId: "node-1",
        nodes: [
          { id: "node-1", type: "Combat", status: "Accessible", rank: 1, difficulty: 1, mapSeed: 123, connections: [], position: { x: 0, y: 0 }, bonusLootCount: 0 }
        ],
        roster: [
          { id: "s1", name: "Soldier 1", archetypeId: "assault", hp: 100, maxHp: 100, soldierAim: 60, xp: 0, level: 1, kills: 0, missions: 0, status: "Healthy", equipment: {}, recoveryTime: 0 }
        ],
        history: [
          { nodeId: "node-0", seed: 1, result: "Won", aliensKilled: 5, scrapGained: 100, intelGained: 2, soldierResults: [], timeSpent: 100 },
          { nodeId: "node-00", seed: 2, result: "Won", aliensKilled: 5, scrapGained: 100, intelGained: 2, soldierResults: [], timeSpent: 100 },
          { nodeId: "node-000", seed: 3, result: "Won", aliensKilled: 5, scrapGained: 100, intelGained: 2, soldierResults: [], timeSpent: 100 }
        ],
        rules: { mode: "Preset", difficulty: "Standard", deathRule: "Iron", allowTacticalPause: true, mapGeneratorType: "DenseShip", difficultyScaling: 1.5, resourceScarcity: 0.7, startingScrap: 300, mapGrowthRate: 0.5, baseEnemyCount: 4, enemyGrowthPerMission: 1.5, economyMode: "Open", skipPrologue: true },
        unlockedArchetypes: ["assault"],
        unlockedItems: ["pistol"],
      };
      localStorage.setItem("voidlock_campaign_v1", JSON.stringify(mockCampaignState));
    });

    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);
    
    // Navigate to campaign via hash or click
    await page.evaluate(() => window.location.hash = "#campaign");
    await page.waitForSelector(".shell-tabs", { visible: true, timeout: 10000 });

    const tabsInfo = await page.evaluate(() => {
      const container = document.querySelector(".shell-tabs") as HTMLElement;
      const topBar = document.getElementById("campaign-shell-top-bar") as HTMLElement;
      
      const containerRect = container.getBoundingClientRect();
      const topBarRect = topBar.getBoundingClientRect();
      
      const tabs = Array.from(container.querySelectorAll(".shell-tab"));
      const wrapped = tabs.some(t => {
        const rect = t.getBoundingClientRect();
        return rect.top > tabs[0].getBoundingClientRect().top + 10;
      });

      return {
        topBarHeight: topBarRect.height,
        containerWidth: containerRect.width,
        isWrapped: wrapped,
        tabCount: tabs.length
      };
    });

    console.log("Tabs Info:", JSON.stringify(tabsInfo, null, 2));
    expect(tabsInfo.tabCount).toBeGreaterThan(0);
    expect(tabsInfo.isWrapped, "Tabs should not wrap to multiple lines").toBe(false);
    expect(tabsInfo.topBarHeight, "Top bar height too large, indicating wrapping").toBeLessThan(120);
  });
});
