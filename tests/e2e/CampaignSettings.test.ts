import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Campaign Settings Tab E2E Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should display Settings tab in Campaign shell and render SettingsScreen", async () => {
    await page.goto(E2E_URL);

    // 1. Navigate to Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // Give it time to transition
    await new Promise(r => setTimeout(r, 1000));

    // Check if we are at the wizard or campaign screen
    const screenInfo = await page.evaluate(() => {
        const wizard = document.querySelector("#screen-new-campaign-wizard");
        const campaign = document.querySelector("#screen-campaign");
        const shell = document.querySelector("#campaign-shell");
        return {
            wizardVisible: wizard && window.getComputedStyle(wizard).display === "flex",
            campaignVisible: campaign && window.getComputedStyle(campaign).display === "flex",
            shellVisible: shell && window.getComputedStyle(shell).display === "flex",
            url: window.location.hash
        };
    });

    if (screenInfo.wizardVisible) {
        await page.click(".difficulty-card:nth-child(1)"); 
        await page.click("#btn-wizard-start");
        await new Promise(r => setTimeout(r, 1000));
    }

    // 2. Wait for Shell tabs
    await page.waitForSelector(".tab-button", { timeout: 10000 });

    // 3. Verify presence of Settings tab
    const tabs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".tab-button")).map(t => t.textContent);
    });
    expect(tabs).toContain("Settings");

    // 4. Click Settings tab
    await page.evaluate(() => {
        const tabList = Array.from(document.querySelectorAll(".tab-button"));
        const settingsTab = tabList.find(t => t.textContent === "Settings") as HTMLElement;
        settingsTab.click();
    });

    // 5. Wait for Settings screen
    await page.waitForSelector("#screen-settings", { timeout: 5000 });

    // 6. Verify Settings screen is visible
    const isVisible = await page.evaluate(() => {
        const screen = document.querySelector("#screen-settings") as HTMLElement;
        return screen && window.getComputedStyle(screen).display === "flex";
    });
    expect(isVisible).toBe(true);

    // 7. Take a screenshot for visual confirmation
    await page.screenshot({
      path: "campaign_settings_verification.png",
    });
  });
});