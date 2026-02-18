import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression voidlock-fh858: Mission Configuration Hidden in Campaign", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  async function resetToMainMenu() {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector("#btn-menu-campaign");
  }

  it("should hide map configuration section when launching from campaign", async () => {
    await resetToMainMenu();

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. Initialize Expedition
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 3. Click first accessible node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 4. We should be in Equipment Screen first (as per GameApp.onCampaignNodeSelect)
    await page.waitForSelector("#screen-equipment");
    
    // 5. Click "Confirm Squad" to go to Mission Setup
    const confirmBtnSelector = '[data-focus-id="btn-confirm-squad"]';
    await page.waitForSelector(confirmBtnSelector);
    await page.click(confirmBtnSelector);

    // 6. Now we are in Mission Setup
    await page.waitForSelector("#screen-mission-setup");

    // Check if #map-config-section is hidden
    const configVisible = await page.evaluate(() => {
      const el = document.getElementById("map-config-section");
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    });

    // Capture screenshot for debugging
    await page.screenshot({
      path: "tests/e2e/__snapshots__/fh858_config_visibility.png",
    });

    expect(configVisible).toBe(false);

    // 7. Test the "Back" button (User says it goes to black screen)
    const backBtnSelector = "#btn-setup-back";
    await page.waitForSelector(backBtnSelector);
    await page.click(backBtnSelector);

    // Should be back in Equipment screen
    await page.waitForSelector("#screen-equipment");

    // 8. Go forward again
    await page.waitForSelector(confirmBtnSelector);
    await page.click(confirmBtnSelector);

    // Should be back in Mission Setup
    await page.waitForSelector("#screen-mission-setup");

    // Check visibility again
    const configVisibleAgain = await page.evaluate(() => {
      const el = document.getElementById("map-config-section");
      if (!el) return false;
      return window.getComputedStyle(el).display !== "none";
    });

    expect(configVisibleAgain).toBe(false);

    // 9. Reload page
    await page.reload();
    await page.waitForSelector("#screen-mission-setup");

    // Check visibility after reload
    const configVisibleAfterReload = await page.evaluate(() => {
      const el = document.getElementById("map-config-section");
      if (!el) return false;
      return window.getComputedStyle(el).display !== "none";
    });

    expect(configVisibleAfterReload).toBe(false);
  });

  it("should hide map configuration section when reloading on Equipment screen and then confirming squad", async () => {
    await resetToMainMenu();

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. Initialize Expedition
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 3. Click first accessible node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 4. We should be in Equipment Screen
    await page.waitForSelector("#screen-equipment");

    // 5. RELOAD page while on Equipment screen
    await page.reload();
    await page.waitForSelector("#screen-equipment");

    // 6. Click "Confirm Squad" to go to Mission Setup
    const confirmBtnSelector = '[data-focus-id="btn-confirm-squad"]';
    await page.waitForSelector(confirmBtnSelector);
    await page.click(confirmBtnSelector);

    // 7. Now we are in Mission Setup
    await page.waitForSelector("#screen-mission-setup");

    // Check if #map-config-section is hidden
    const configVisible = await page.evaluate(() => {
      const el = document.getElementById("map-config-section");
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    });

    expect(configVisible).toBe(false);
  });
});
