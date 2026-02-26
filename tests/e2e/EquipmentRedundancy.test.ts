import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Equipment Screen Redundancy Reproduction", () => {
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

  it("should demonstrate redundant Confirm Squad button and Launch Mission placement", async () => {
    await page.goto(E2E_URL);

    // 1. Click "Campaign" on Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    
    // Wait for title splash to complete (Spec 8.1)
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 5000 });
    
    await page.click("#btn-menu-campaign");

    // 2. Initialize Expedition
    const startBtnSelector = '[data-focus-id="btn-start-campaign"]';
    try {
      await page.waitForSelector(startBtnSelector, { timeout: 5000 });
    } catch (e) {
      await page.screenshot({ path: "tests/e2e/__snapshots__/debug_start_campaign_missing.png" });
      throw e;
    }
    await page.click(startBtnSelector);

    // 3. Select first node to enter Equipment Screen
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 4. Verify we are on Equipment Screen
    await page.waitForSelector("#screen-equipment");

    // 5. Check for "Confirm Squad" and "Launch Mission" buttons
    const confirmSquadBtn = await page.$('[data-focus-id="btn-confirm-squad"]');
    const launchMissionBtn = await page.$('[data-focus-id="btn-launch-mission"]');
    const backBtn = await page.$('[data-focus-id="btn-back"]');

    expect(confirmSquadBtn).not.toBeNull();
    expect(launchMissionBtn).not.toBeNull();
    expect(backBtn).not.toBeNull();

    const confirmSquadText = await page.evaluate(el => el?.textContent, confirmSquadBtn);
    expect(confirmSquadText).toBe("Confirm Squad");

    const launchMissionText = await page.evaluate(el => el?.textContent, launchMissionBtn);
    expect(launchMissionText).toBe("Launch Mission");

    // Capture screenshot of the footer
    await page.screenshot({
      path: "tests/e2e/__snapshots__/equipment_redundancy_footer.png",
    });

    // 6. Demonstrate "Confirm Squad" performs same navigation as "Back" (returns to Sector Map)
    await page.click('[data-focus-id="btn-confirm-squad"]');
    
    // Wait for transition back to Campaign screen (Sector Map)
    await page.waitForSelector("#screen-campaign");
    
    const campaignVisible = await page.evaluate(() => {
      const el = document.getElementById("screen-campaign");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(campaignVisible).toBe(true);

    // Capture screenshot of the return to Sector Map
    await page.screenshot({
      path: "tests/e2e/__snapshots__/equipment_redundancy_return.png",
    });

    // 7. Go back to Equipment screen to test Launch Mission
    await page.click(nodeSelector);
    await page.waitForSelector("#screen-equipment");

    // 8. Demonstrate "Launch Mission" starts the mission
    await page.click('[data-focus-id="btn-launch-mission"]');

    // Wait for Deployment Phase (indicated by the top bar)
    await page.waitForFunction(() => {
      const topBar = document.querySelector(".deployment-phase-indicator"); // This might need verification
      // Actually let's look for the canvas or something that indicates mission started
      return !!document.getElementById("game-canvas");
    });

    const canvasVisible = await page.evaluate(() => {
      const el = document.getElementById("game-canvas");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(canvasVisible).toBe(true);

    // Capture screenshot of the mission start
    await page.screenshot({
      path: "tests/e2e/__snapshots__/equipment_redundancy_launch.png",
    });
  });
});
