import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Custom Mission Scrollbar Clipping Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Use the viewport size suggested in the task
    await page.setViewport({ width: 800, height: 600 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should ensure the 'Confirm' button is reachable on small viewports", async () => {
    await page.goto(E2E_URL);
    
    // 1. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    
    // 2. Wait for Mission Setup screen
    await page.waitForSelector("#screen-mission-setup");
    
    // 3. Take a screenshot for visual verification
    await page.screenshot({ path: "tests/e2e/__snapshots__/scrollbar_clipping_verification.png" });
    
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

    // The task requires asserting that the button is EITHER off-screen OR the container is scrollable.
    // In a fixed state, we actually want it to be reachable. 
    // If it's off-screen, it MUST be scrollable.
    // If it's not off-screen, then it's already reachable.
    
    const conditionMet = !isButtonInViewport || isScrollable;
    expect(conditionMet, "The button should either be in viewport, or the container should be scrollable to reach it").toBe(true);
    
    // Additional check: If it's off-screen, it MUST be scrollable (to satisfy the 'reachable' requirement)
    if (!isButtonInViewport) {
      expect(isScrollable, "If button is off-screen, the container MUST be scrollable").toBe(true);
    }
  });
});
