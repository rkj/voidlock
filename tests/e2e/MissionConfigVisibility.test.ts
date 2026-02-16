import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mission Configuration Visibility", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should hide map configuration when launching from Campaign", async () => {
    await page.goto(E2E_URL);

    // 1. Click "Campaign" on Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. New Campaign Wizard
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 3. Sector Map - click node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 4. Should be in Equipment screen first
    await page.waitForSelector("#screen-equipment");
    
    // 5. Click "Confirm Squad" (or whatever the button is in EquipmentScreen)
    // Looking at GameApp.ts, it seems EquipmentScreen uses onEquipmentConfirmed
    // Let's find the button in EquipmentScreen.ts
    const confirmSquadBtn = "[data-focus-id=\"btn-confirm-squad\"]";
    await page.waitForSelector(confirmSquadBtn);
    await page.click(confirmSquadBtn);

    // 6. Now in Mission Setup
    await page.waitForSelector("#screen-mission-setup");

    // ASSERTION: Map Configuration section should be hidden
    const configVisible = await page.evaluate(() => {
      const el = document.getElementById("map-config-section");
      return el ? window.getComputedStyle(el).display !== "none" : false;
    });

    // Take screenshot for proof
    await page.screenshot({
      path: "tests/e2e/__snapshots__/mission_config_visibility_repro.png",
    });

    expect(configVisible).toBe(false);
  });
});
