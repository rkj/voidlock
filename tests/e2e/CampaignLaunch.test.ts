import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Campaign Mission Launch Visual Regression", () => {
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

  it("should show campaign shell when entering mission setup (nested architecture)", async () => {
    await page.goto(E2E_URL);

    // 1. Click "Campaign" on Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. New Campaign Wizard should be visible. Click "Initialize Expedition"
    // Using a more robust selector for the primary button in the wizard
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 3. Wait for the Sector Map and click the first accessible node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 4. Now we should be in "Mission Setup"
    await page.waitForSelector("#screen-mission-setup");

    // Verification: In the current architecture (ADR 0028/CampaignShell),
    // #screen-mission-setup is nested INSIDE #screen-campaign-shell.
    // Therefore, the shell MUST be visible (flex) for the setup screen to be visible.

    const shellDisplay = await page.evaluate(() => {
      const shell = document.getElementById("screen-campaign-shell");
      return shell ? window.getComputedStyle(shell).display : "not found";
    });

    // Capture screenshot for visual proof of the state
    await page.screenshot({
      path: "tests/e2e/__snapshots__/campaign_launch_verification.png",
    });

    // ASSERTION: The shell MUST be visible (display: flex)
    expect(shellDisplay).toBe("flex");
  });
});
