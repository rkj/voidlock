import { describe, it, expect, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Campaign Screen Repro", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  it("should display the Campaign Screen correctly on mobile (400x800)", async () => {
    const page = await getNewPage();
    await page.setViewport({ width: 400, height: 800 });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 2. Check for Campaign Shell
    await page.waitForSelector("#screen-campaign-shell");
    
    // 3. Take screenshot of the Sector Map
    await page.screenshot({ path: "debug_mobile_campaign.png" });

    const topBarHtml = await page.evaluate(() => {
      return document.getElementById("campaign-shell-top-bar")?.innerHTML;
    });
    console.log("Top Bar HTML:", topBarHtml);

    // 4. Verify nodes are visible and clickable
    const nodes = await page.$$(".campaign-node.accessible");
    console.log(`Found ${nodes.length} accessible nodes`);
    expect(nodes.length).toBeGreaterThan(0);

    // 5. Check if resources are visible
    const resources = await page.$(".shell-resources");
    expect(resources).toBeTruthy();

    // 6. Check if tabs are visible
    const tabs = await page.$$(".tab-button");
    console.log(`Found ${tabs.length} tabs`);
    expect(tabs.length).toBeGreaterThan(0);

    // 7. Verify tabs are scrollable if needed (we just check they exist)
    const tabsVisible = await page.evaluate(() => {
      const el = document.querySelector(".shell-tabs");
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    expect(tabsVisible).toBe(true);
  });
});
