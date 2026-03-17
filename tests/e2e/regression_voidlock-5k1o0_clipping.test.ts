import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression voidlock-5k1o0: Campaign setup stats bar clipped on mobile", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should not have clipping on the campaign shell footer at 390x844", async () => {
    // 1. Set mobile viewport
    await page.setViewport({ width: 390, height: 844 });
    
    // 2. Initial load
    await page.goto(E2E_URL);
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // 3. Setup Active Campaign state
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
        currentNodeId: "node-1",
        nodes: [
          { id: "node-1", type: "Combat", status: "Accessible", rank: 0, difficulty: 1, mapSeed: 123, connections: [], position: { x: 0, y: 0 }, bonusLootCount: 0 }
        ],
        roster: [],
        history: [],
        rules: { mode: "Preset", difficulty: "Standard", deathRule: "Iron", allowTacticalPause: true, mapGeneratorType: "DenseShip", difficultyScaling: 1.5, resourceScarcity: 0.7, startingScrap: 300, mapGrowthRate: 0.5, baseEnemyCount: 4, enemyGrowthPerMission: 1.5, economyMode: "Open", skipPrologue: false },
        unlockedArchetypes: ["assault"],
        unlockedItems: ["pistol"],
      };
      localStorage.setItem("voidlock_campaign_v1", JSON.stringify(mockCampaignState));
      localStorage.setItem("voidlock_session_state", JSON.stringify({ screenId: "campaign", isCampaign: true }));
    });

    // 4. Navigate to Campaign (Sector Map)
    await page.goto(E2E_URL + "#campaign");
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);
    await page.waitForSelector("#campaign-shell-footer", { visible: true, timeout: 10000 });

    // 5. Check for clipping
    const clippingInfo = await page.evaluate(() => {
      const shell = document.querySelector(".campaign-shell") as HTMLElement;
      if (!shell) return { error: "Shell not found" };
      
      const children = Array.from(shell.children).map(c => ({
        id: c.id,
        className: c.className,
        offsetHeight: (c as HTMLElement).offsetHeight,
        clientHeight: (c as HTMLElement).clientHeight,
        scrollHeight: (c as HTMLElement).scrollHeight,
        computedHeight: window.getComputedStyle(c).height,
        marginTop: window.getComputedStyle(c).marginTop,
        marginBottom: window.getComputedStyle(c).marginBottom
      }));

      return {
        shellHeight: shell.offsetHeight,
        shellClientHeight: shell.clientHeight,
        shellScrollHeight: shell.scrollHeight,
        isClipped: shell.scrollHeight > shell.clientHeight,
        children,
        windowHeight: window.innerHeight
      };
    });

    console.log("Detailed Clipping Info:", JSON.stringify(clippingInfo, null, 2));

    // 6. Take screenshot for visual audit
    await page.screenshot({ path: "tests/e2e/screenshots/voidlock-5k1o0_repro_mobile.png" });

    expect(clippingInfo.isClipped, `Container should not be clipped (scrollHeight: ${clippingInfo.scrollHeight}, clientHeight: ${clippingInfo.clientHeight})`).toBe(false);
    if (clippingInfo.footerBottom !== undefined) {
        expect(clippingInfo.footerBottom).toBeLessThanOrEqual(clippingInfo.windowHeight);
    }
  });
});
