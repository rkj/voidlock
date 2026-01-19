import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";

describe("Custom Mission Scrollbar Clipping Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 600, height: 400 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should reproduce scrollbar clipping/accessibility issue on small viewports", async () => {
    await page.goto("http://localhost:5173");
    
    // 1. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    
    // 2. Wait for Mission Setup screen
    await page.waitForSelector("#screen-mission-setup");
    
    // 3. Take a screenshot to visualize the clipping
    await page.screenshot({ path: "tests/e2e/__snapshots__/scrollbar_clipping_repro.png" });
    
    // 4. Check if the "Confirm" button (btn-goto-equipment) is in the viewport
    const isButtonInViewport = await page.evaluate(() => {
      const btn = document.getElementById("btn-goto-equipment");
      if (!btn) return false;
      const rect = btn.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    });
    
    // 5. Check if the container is scrollable
    const isScrollable = await page.evaluate(() => {
      const container = document.getElementById("setup-content");
      if (!container) return false;
      return container.scrollHeight > container.clientHeight;
    });

    console.log(`Button in viewport: ${isButtonInViewport}`);
    console.log(`Container is scrollable: ${isScrollable}`);

    // STRICT ASSERTION: The button MUST be reachable. 
    // If it's off-screen, the user cannot click it. 
    // The container being scrollable is irrelevant if the button isn't inside the scrollable area or reachable.
    expect(isButtonInViewport, "Critical Action Button (Confirm) is NOT visible in the viewport").toBe(true);
  });
});
