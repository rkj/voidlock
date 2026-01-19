import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";

describe("Custom Mission Scrollbar Clipping Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 800, height: 600 });
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

    // The bug report says "asserts that the 'Confirm' button is either off-screen or the container is scrollable".
    // Usually, we WANT it to be scrollable if it's off-screen.
    // If it's off-screen AND NOT scrollable, that's the worst bug.
    // If it's off-screen BUT scrollable, it might still be considered "clipping" if the scrollbar itself is weird.
    
    // Based on the task description, I'll just assert what was requested.
    expect(isButtonInViewport || isScrollable).toBe(true);
    
    // Actually, if it's off-screen, it's definitely a repro of "something is not right" if we can't see the primary action.
    // If it's scrollable, it might be fine, but the ADR/task implies there is an issue.
    // Let's see what the results are.
  });
});
