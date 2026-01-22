import { describe, it, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("HUD Visual Audit", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should capture a screenshot of the tactical HUD", async () => {
    await page.goto(E2E_URL);

    // 1. Click "Custom Mission" on Main Menu
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Wait for Mission Setup and click "Launch Mission"
    // We might need to wait for squad builder to initialize
    await page.waitForSelector("#squad-builder");

    // Use a button that launches the mission.
    // In index.html, there isn't a direct "Launch Mission" button in #screen-mission-setup,
    // it's likely injected or it's #btn-goto-equipment then launch.
    // Actually, looking at index.html:
    // <button id="btn-goto-equipment" ...>Equipment & Supplies</button>

    await page.click("#btn-goto-equipment");
    await page.waitForSelector("#screen-equipment");

    // In Equipment screen, there should be a "Confirm Squad" button.
    const startMissionBtn = "#screen-equipment .primary-button";
    await page.waitForSelector(startMissionBtn);
    await page.click(startMissionBtn);

    // 3. Wait for Mission Screen
    await page.waitForSelector("#screen-mission");

    // Wait a bit for the engine to start and HUD to populate
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 4. Capture screenshot
    await page.screenshot({ path: "tests/e2e/__snapshots__/hud_audit.png" });

    console.log("Screenshot saved to tests/e2e/__snapshots__/hud_audit.png");
  });
});
