import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Campaign Duration Selector E2E", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should allow selecting campaign duration in the wizard", async () => {
    await page.goto(E2E_URL);

    // 1. Click "Campaign" on Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    
    // Wait for splash to complete (ADR 0019/MainMenuScreen)
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 5000 });
    
    await page.click("#btn-menu-campaign");

    // 2. Verify Campaign Duration selector is present
    const durationSelector = "#campaign-duration";
    await page.waitForSelector(durationSelector);

    // Take screenshot of the wizard with the selector
    await page.setViewport({ width: 1024, height: 768 });
    await page.screenshot({
      path: "tests/e2e/__snapshots__/campaign_duration_wizard_1024.png",
    });

    await page.setViewport({ width: 400, height: 800 });
    await page.screenshot({
      path: "tests/e2e/__snapshots__/campaign_duration_wizard_400.png",
    });

    // 3. Select "Short" duration
    await page.select(durationSelector, "1.0");

    // 4. Start Campaign
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.click(startBtnSelector);

    // 5. Verify we reach the Sector Map
    await page.waitForSelector(".campaign-node.accessible");

    // 6. Inspect the campaign state in localStorage to verify mapGrowthRate
    const mapGrowthRate = await page.evaluate(() => {
      const stateStr = localStorage.getItem("voidlock_campaign_v1");
      if (!stateStr) return null;
      const state = JSON.parse(stateStr);
      return state.rules.mapGrowthRate;
    });

    expect(mapGrowthRate).toBe(1.0);
  });
});
