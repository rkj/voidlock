import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Navigation & Routing Reproduction", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should go to Main Menu when URL fragment is removed", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-campaign");

    // 1. Navigate to Campaign (Wizard)
    await page.click("#btn-menu-campaign");
    await page.waitForFunction(() => window.location.hash === "#campaign");

    // 2. Remove hash manually
    await page.evaluate(() => {
      window.location.hash = "";
    });

    // 3. Should be back at Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    const currentHash = await page.evaluate(() => window.location.hash);
    expect(currentHash).toBe("");
    
    // Check if main menu is visible
    const mainMenuVisible = await page.evaluate(() => {
      const el = document.getElementById("screen-main-menu");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(mainMenuVisible).toBe(true);
  });

  it("should go to Main Menu on page REFRESH if URL fragment is missing", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-campaign");

    // 1. Navigate to Campaign (Wizard)
    await page.click("#btn-menu-campaign");
    await page.waitForFunction(() => window.location.hash === "#campaign");

    // 2. Refresh page without hash
    await page.goto(E2E_URL); // goto without hash

    // 3. Should be at Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    const currentHash = await page.evaluate(() => window.location.hash);
    expect(currentHash).toBe("");

    const mainMenuVisible = await page.evaluate(() => {
      const el = document.getElementById("screen-main-menu");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(mainMenuVisible).toBe(true);
  });

  it("should handle back navigation from settings to equipment", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector("#btn-menu-campaign");

    // 1. Start a new campaign to reach the sector map
    await page.click("#btn-menu-campaign");
    await page.waitForSelector(".campaign-setup-wizard .primary-button");
    await page.click(".campaign-setup-wizard .primary-button");
    await page.waitForSelector(".campaign-node.accessible");

    // 2. Click a node to reach equipment (Ready Room)
    await page.click(".campaign-node.accessible");
    await page.waitForSelector("#screen-equipment");
    await page.waitForFunction(() => window.location.hash === "#equipment");

    // 3. Click "Settings" tab in the shell
    await page.waitForSelector(".shell-tab[data-id=\"settings\"]");
    await page.click(".shell-tab[data-id=\"settings\"]");
    await page.waitForSelector("#screen-settings");
    await page.waitForFunction(() => window.location.hash === "#settings");

    // 4. Click "Back" or press ESC in Settings
    await page.keyboard.press("Escape");

    // 5. Should be back at Equipment
    await page.waitForSelector("#screen-equipment");
    expect(await page.evaluate(() => window.location.hash)).toBe("#equipment");
  });
});
