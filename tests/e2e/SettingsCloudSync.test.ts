import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Settings Cloud Sync Visual Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show settings screen and verify cloud sync status", async () => {
    await page.goto(E2E_URL);

    // 1. Click "Settings" on Main Menu (it might be under "Global Settings" or similar)
    // Wait, let's see where the settings button is.
    // In MainMenuScreen.ts, it's usually there.
    await page.waitForSelector("#btn-menu-settings");
    await page.click("#btn-menu-settings");

    // 2. Wait for settings screen
    await page.waitForSelector("#screen-settings");

    // 3. Find the Cloud Sync toggle and label
    const syncInfo = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const syncLabel = labels.find(l => l.textContent.includes("Enable Cloud Sync:"));
      if (!syncLabel) return { found: false };
      
      const syncToggle = syncLabel.nextElementSibling as HTMLInputElement;
      return {
        found: true,
        label: syncLabel.textContent,
        disabled: syncToggle?.disabled,
        checked: syncToggle?.checked
      };
    });

    expect(syncInfo.found).toBe(true);

    // 4. Take screenshots at 1024x768 and 400x800
    await page.setViewport({ width: 1024, height: 768 });
    await page.screenshot({ path: "screenshots/settings_cloud_sync_desktop.png" });

    await page.setViewport({ width: 400, height: 800 });
    await page.screenshot({ path: "screenshots/settings_cloud_sync_mobile.png" });

    console.log("Sync Info:", syncInfo);
  });
});
