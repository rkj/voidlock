import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression voidlock-bpgp6: Engineering tab bar clipped on mobile", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show 'System Engineering' tab and allow horizontal scroll on 390x844", async () => {
    // 1. Set mobile viewport
    await page.setViewport({ width: 390, height: 844 });
    
    // 2. Load page
    await page.goto(E2E_URL);
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // 3. Setup Active Campaign state
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
          { nodeId: "node-0", type: "Combat", result: "Won", aliensKilled: 5, scrapGained: 100, intelGained: 2, soldierResults: [], timeSpent: 100 },
          { nodeId: "node-00", type: "Combat", result: "Won", aliensKilled: 5, scrapGained: 100, intelGained: 2, soldierResults: [], timeSpent: 100 },
          { nodeId: "node-000", type: "Combat", result: "Won", aliensKilled: 5, scrapGained: 100, intelGained: 2, soldierResults: [], timeSpent: 100 }
        ],
        rules: { mode: "Preset", difficulty: "Standard", deathRule: "Iron", allowTacticalPause: true, mapGeneratorType: "DenseShip", difficultyScaling: 1.5, resourceScarcity: 0.7, startingScrap: 300, mapGrowthRate: 0.5, baseEnemyCount: 4, enemyGrowthPerMission: 1.5, economyMode: "Open", skipPrologue: false },
        unlockedArchetypes: ["assault"],
        unlockedItems: ["pistol"],
      };
      localStorage.setItem("voidlock_campaign_v1", JSON.stringify(mockCampaignState));
      
      const mockMetaStats = {
        totalCampaignsStarted: 1,
        campaignsWon: 0,
        campaignsLost: 0,
        totalKills: 10,
        totalCasualties: 0,
        totalMissionsPlayed: 3,
        totalMissionsWon: 3,
        totalScrapEarned: 200,
        currentIntel: 4,
        unlockedArchetypes: ["assault", "medic", "scout"],
        unlockedItems: [],
        prologueCompleted: true
      };
      localStorage.setItem("voidlock_meta_v1", JSON.stringify(mockMetaStats));
    });

    // 4. Go to campaign directly
    await page.goto(E2E_URL + "#campaign");
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);
    await page.waitForSelector(".shell-tabs", { visible: true, timeout: 10000 });

    // 5. Check if 'System Engineering' tab is visible or reachable
    const tabsInfo = await page.evaluate(() => {
      const tabsContainer = document.querySelector(".shell-tabs") as HTMLElement;
      if (!tabsContainer) return { error: "Tabs container not found" };
      
      const tabs = Array.from(tabsContainer.querySelectorAll(".shell-tab"));
      const engineeringTab = tabs.find(t => t.textContent?.includes("System Engineering")) as HTMLElement;
      
      if (!engineeringTab) return { error: "Engineering tab not found", tabLabels: tabs.map(t => t.textContent) };

      const containerRect = tabsContainer.getBoundingClientRect();
      const tabRect = engineeringTab.getBoundingClientRect();

      return {
        containerWidth: containerRect.width,
        containerScrollWidth: tabsContainer.scrollWidth,
        tabLeft: tabRect.left,
        tabRight: tabRect.right,
        tabWidth: tabRect.width,
        isFullyVisible: tabRect.left >= containerRect.left && tabRect.right <= containerRect.right,
        isClippedByParent: tabRect.right > containerRect.right + 1,
        canScroll: tabsContainer.scrollWidth > tabsContainer.clientWidth,
        parentOverflow: window.getComputedStyle(tabsContainer.parentElement!).overflow,
        parentDisplay: window.getComputedStyle(tabsContainer.parentElement!).display
      };
    });

    console.log("Tabs Info:", JSON.stringify(tabsInfo, null, 2));

    await page.screenshot({ path: "tests/e2e/screenshots/voidlock-bpgp6_final_tabs.png" });

    if (tabsInfo.error) {
        throw new Error(tabsInfo.error + (tabsInfo.tabLabels ? ": " + tabsInfo.tabLabels.join(", ") : ""));
    }

    // The engineering tab should be reachable via scroll if not fully visible
    expect(tabsInfo.containerScrollWidth).toBeGreaterThan(tabsInfo.containerWidth - 5);
    expect(tabsInfo.canScroll).toBe(true);
    expect(tabsInfo.parentOverflow).not.toBe("hidden");
  });
});
