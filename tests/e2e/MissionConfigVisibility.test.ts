import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mission Configuration Visibility", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should HIDE mission configuration when launching from Campaign even after Custom Mission", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Click "Custom Mission" to ensure config is shown
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup");
    
    const isVisibleCustom = await page.evaluate(() => {
      const el = document.getElementById("map-config-section");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(isVisibleCustom).toBe(true);

    // 2. Go back to Main Menu
    await page.click("#btn-setup-back");
    await page.waitForSelector("#screen-main-menu");

    // 3. Start a New Campaign
    await page.click("#btn-menu-campaign");

    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 4. Select a node on the Sector Map
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 5. We are now in Equipment screen
    await page.waitForSelector("#screen-equipment");
    const confirmBtn = await page.waitForSelector("#screen-equipment .primary-button");
    await confirmBtn?.click();

    // 6. Now we should be in Mission Setup
    await page.waitForSelector("#screen-mission-setup");

    // ASSERTION: Map configuration should be HIDDEN
    const isVisibleCampaign = await page.evaluate(() => {
      const el = document.getElementById("map-config-section");
      if (!el) return false;
      return window.getComputedStyle(el).display !== "none";
    });

    await page.screenshot({ path: "screenshots/repro_campaign_after_custom.png" });

    expect(isVisibleCampaign).toBe(false);
  });

  it("should HIDE mission configuration when refreshing on Equipment screen during Campaign", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Start a New Campaign
    await page.click("#btn-menu-campaign");
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 2. Select a node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 3. We are in Equipment screen. RELOAD.
    await page.waitForSelector("#screen-equipment");
    await page.reload();
    await page.waitForSelector("#screen-equipment");

    // 4. Confirm Loadout
    const confirmBtn = await page.waitForSelector("#screen-equipment .primary-button");
    await confirmBtn?.click();

    // 5. We are now in Mission Setup
    await page.waitForSelector("#screen-mission-setup");

    // ASSERTION: Map configuration should be HIDDEN
    const isVisible = await page.evaluate(() => {
      const el = document.getElementById("map-config-section");
      if (!el) return false;
      return window.getComputedStyle(el).display !== "none";
    });

    await page.screenshot({ path: "screenshots/repro_refresh_equipment.png" });

    expect(isVisible).toBe(false);
  });
});
