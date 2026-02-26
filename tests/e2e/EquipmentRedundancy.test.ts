import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Equipment Screen Redundancy Regression", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Ensure clean state
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should verify removal of redundant Confirm Squad button and proper button placement", async () => {
    await page.goto(E2E_URL);

    // 1. Click "Campaign" on Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 5000 });
    await page.click("#btn-menu-campaign");

    // 2. Initialize Expedition
    const startBtnSelector = '[data-focus-id="btn-start-campaign"]';
    await page.waitForSelector(startBtnSelector, { timeout: 5000 });
    await page.click(startBtnSelector);

    // 3. Select first node to enter Equipment Screen
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 4. Verify we are on Equipment Screen
    await page.waitForSelector("#screen-equipment");

    // 5. Verify "Confirm Squad" is GONE and "Launch Mission" and "Back" are present
    const confirmSquadBtn = await page.$('[data-focus-id="btn-confirm-squad"]');
    const launchMissionBtn = await page.$('[data-focus-id="btn-launch-mission"]');
    const backBtn = await page.$('[data-focus-id="btn-back"]');

    expect(confirmSquadBtn).toBeNull();
    expect(launchMissionBtn).not.toBeNull();
    expect(backBtn).not.toBeNull();

    // 6. Verify button text
    const launchMissionText = await page.evaluate(el => el?.textContent, launchMissionBtn);
    expect(launchMissionText).toBe("Launch Mission");

    const backText = await page.evaluate(el => el?.textContent, backBtn);
    expect(backText).toBe("Back");

    // Capture screenshot of the cleaned up footer
    await page.screenshot({
      path: "tests/e2e/__snapshots__/equipment_redundancy_fixed_footer.png",
    });

    // 7. Verify "Back" returns to Sector Map
    await page.click('[data-focus-id="btn-back"]');
    await page.waitForSelector("#screen-campaign");
    
    const campaignVisible = await page.evaluate(() => {
      const el = document.getElementById("screen-campaign");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(campaignVisible).toBe(true);

    // 8. Go back to Equipment screen to test Launch Mission
    await page.click(nodeSelector);
    await page.waitForSelector("#screen-equipment");

    // 9. Verify "Launch Mission" starts the mission
    await page.click('[data-focus-id="btn-launch-mission"]');

    // Wait for Deployment Phase
    await page.waitForFunction(() => {
      return !!document.getElementById("game-canvas");
    });

    const canvasVisible = await page.evaluate(() => {
      const el = document.getElementById("game-canvas");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(canvasVisible).toBe(true);

    // Capture screenshot of the mission start from the new flow
    await page.screenshot({
      path: "tests/e2e/__snapshots__/equipment_redundancy_fixed_launch.png",
    });
  });
});
