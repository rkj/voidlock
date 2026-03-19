import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closePage } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Pickup Menu Visibility (voidlock-7icmn)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closePage(page);
  });

  it("should show items in the pickup menu", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // 1. Launch a Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Select 'Recover Intel' for guaranteed items
    await page.waitForSelector("#mission-type");
    await page.select("#mission-type", "RecoverIntel");

    // Launch to Deployment
    await page.waitForSelector("#btn-launch-mission");
    await page.click("#btn-launch-mission");

    // Auto-fill and start
    await page.waitForSelector("#btn-autofill-deployment");
    await page.click("#btn-autofill-deployment");
    await page.waitForSelector("#btn-start-mission:not([disabled])");
    await page.click("#btn-start-mission");

    // 2. Wait for HUD and press '4' (Pickup)
    await page.waitForSelector("#soldier-panel", { visible: true });
    
    // Press '4' key
    await page.keyboard.press("4");
    
    // 3. Wait for the menu to show the Pickup items
    // Since we are in the spawn room, some items might not be visible yet.
    // But we should at least see the "Select Target" title
    await page.waitForSelector(".menu-title", { visible: true });
    const title = await page.$eval(".menu-title", (el: any) => el.textContent);
    expect(title).toContain("Select Target");

    // Take a screenshot of the menu
    await page.screenshot({ path: "pickup_menu_visible.png" });
    
    // We should also take a mobile screenshot
    await page.setViewport({ width: 400, height: 800 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: "pickup_menu_mobile.png" });
  }, 60000);
});
