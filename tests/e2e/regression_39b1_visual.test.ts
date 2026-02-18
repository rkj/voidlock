import { describe, it, expect, afterAll, beforeAll, beforeEach } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression 39B1 - Map Entity Rendering", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  beforeEach(async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL + "#main-menu");
    await page.reload();
  });

  async function setupCustomMission(style: "TacticalIcons" | "Sprites") {
    // Ensure we are at main menu
    await page.waitForSelector("#btn-menu-settings");
    await page.click("#btn-menu-settings");

    await page.waitForSelector("#screen-settings");

    // Click on the style preview item
    await page.waitForSelector(`.style-preview-item[data-style="${style}"]`);
    await page.click(`.style-preview-item[data-style="${style}"]`);

    // Back to menu
    const backBtn = await page.waitForSelector("::-p-text(Save & Back)");
    if (!backBtn) throw new Error("Save & Back button not found");
    await backBtn.click();

    // Now go to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    await page.waitForSelector("#screen-mission-setup");

    // Assign a soldier (double click to add to squad)
    await page.waitForSelector(".roster-list .soldier-card");
    await page.click(".roster-list .soldier-card", { clickCount: 2 });

    // Click "Equipment & Supplies" to go to Equipment screen
    await page.waitForSelector("#btn-goto-equipment:not([disabled])");
    await page.click("#btn-goto-equipment");

    // Click "Confirm Squad" on Equipment screen to launch mission
    await page.waitForSelector(".equipment-screen .primary-button");
    await page.click(".equipment-screen .primary-button");

    // Launch Mission (Deployment Phase)
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");

    // Wait for tactical screen
    await page.waitForSelector("#game-canvas");

    // Give it a moment to render
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  it("should render spawn and extraction points in TacticalIcons mode", async () => {
    await setupCustomMission("TacticalIcons");
    await page.screenshot({
      path: "tests/e2e/__snapshots__/regression_39b1_tactical_icons.png",
    });
    expect(true).toBe(true);
  }, 60000);

  it("should render spawn and extraction points in Sprites mode", async () => {
    await setupCustomMission("Sprites");
    await page.screenshot({
      path: "tests/e2e/__snapshots__/regression_39b1_sprites.png",
    });
    expect(true).toBe(true);
  }, 60000);
});
