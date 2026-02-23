import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression voidlock-fh858: Mission Configuration Hidden in Campaign (New Flow)", () => {
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

  it("should skip mission setup and launch directly from equipment in campaign", async () => {
    await resetToMainMenu();

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign", { visible: true });
    await new Promise(r => setTimeout(r, 100)); // Small delay to avoid flaky click
    await page.click("#btn-menu-campaign");

    // 2. Initialize Expedition
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector, { visible: true });
    await page.click(startBtnSelector);

    // 3. Click first accessible node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector, { visible: true });
    await page.click(nodeSelector);

    // 4. We should be in Equipment Screen (New Flow: Sector -> Equipment)
    await page.waitForSelector("#screen-equipment", { visible: true });
    
    // 5. Verify "Launch Mission" button exists and "Confirm Squad" exists
    const launchBtnSelector = '[data-focus-id="btn-launch-mission"]';
    await page.waitForSelector(launchBtnSelector, { visible: true });
    
    const confirmBtnSelector = '[data-focus-id="btn-confirm-squad"]';
    await page.waitForSelector(confirmBtnSelector, { visible: true });

    // 6. Test the "Back" button (Should go to Sector Map)
    const backBtnSelector = '[data-focus-id="btn-back"]';
    await page.waitForSelector(backBtnSelector, { visible: true });
    await page.click(backBtnSelector);

    // Should be back in Sector Map (Campaign Screen)
    await page.waitForSelector("#screen-campaign", { visible: true });

    // 7. Click node again
    await page.click(nodeSelector);
    await page.waitForSelector("#screen-equipment", { visible: true });

    // 8. Test "Confirm Squad" (Should go back to Sector Map)
    await page.click(confirmBtnSelector);
    await page.waitForSelector("#screen-campaign", { visible: true });

    // 9. Click node again
    await page.click(nodeSelector);
    await page.waitForSelector("#screen-equipment", { visible: true });

    // 10. Launch Mission
    await page.click(launchBtnSelector);

    // 11. Verify we go to tactical mission screen, bypassing mission setup
    // We check that mission setup screen is NOT visible
    const missionSetupVisible = await page.evaluate(() => {
      const el = document.getElementById("screen-mission-setup");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(missionSetupVisible).toBe(false);

    // Verify HUD or some mission element
    await page.waitForSelector("#top-bar", { visible: true, timeout: 15000 });
  });

  it("should maintain equipment screen state after reload in campaign", async () => {
    await resetToMainMenu();

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign", { visible: true });
    await new Promise(r => setTimeout(r, 100));
    await page.click("#btn-menu-campaign");

    // 2. Initialize Expedition
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector, { visible: true });
    await page.click(startBtnSelector);

    // 3. Click first accessible node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector, { visible: true });
    await page.click(nodeSelector);

    // 4. We should be in Equipment Screen
    await page.waitForSelector("#screen-equipment", { visible: true });

    // 5. RELOAD page while on Equipment screen
    await page.reload();
    
    // 6. Verify we are back on Equipment screen and NOT Sector Map or Mission Setup
    await page.waitForSelector("#screen-equipment", { visible: true });
    
    const campaignVisible = await page.evaluate(() => {
      const el = document.getElementById("screen-campaign");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(campaignVisible).toBe(false);

    const missionSetupVisible = await page.evaluate(() => {
      const el = document.getElementById("screen-mission-setup");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(missionSetupVisible).toBe(false);

    // 7. Verify "Launch Mission" button still exists
    await page.waitForSelector('[data-focus-id="btn-launch-mission"]', { visible: true });
  });
});
