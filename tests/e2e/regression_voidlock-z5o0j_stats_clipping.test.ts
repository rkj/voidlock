import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Statistics Screen Mobile Clipping Regression", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Test on 390x844 as per issue description
    await page.setViewport({ width: 390, height: 844 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should not clip stat labels horizontally on mobile", async () => {
    await page.goto(E2E_URL, { waitUntil: "load" });

    // 1. Navigate to Statistics Screen
    await page.waitForSelector("#btn-menu-statistics");
    // Ensure the button is visible before clicking
    await page.evaluate(() => {
      document.getElementById("btn-menu-statistics")?.scrollIntoView();
    });
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
    await page.click("#btn-menu-statistics");

    // 2. Wait for Statistics screen and the grid
    await page.waitForSelector("#screen-statistics");
    await page.waitForSelector(".scroll-content > .flex-col");

    // Give it a moment to render
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));

    // 3. Take a screenshot for visual verification
    await page.screenshot({
      path: "tests/e2e/__snapshots__/voidlock-z5o0j_stats_clipping.png",
    });

    // 4. Verify that the statsGrid width does not exceed its parent or window
    const isClipped = await page.evaluate(() => {
      const statsGrid = document.querySelector("#screen-statistics .scroll-content > .flex-col");
      if (!statsGrid) return true; // Fail if not found
      
      const rect = statsGrid.getBoundingClientRect();
      const parentRect = statsGrid.parentElement!.getBoundingClientRect();
      
      // If the left side of the grid is negative or the width exceeds the screen, it's clipped
      return rect.left < 0 || rect.width > window.innerWidth || rect.left < parentRect.left;
    });

    expect(isClipped, "The stats grid should be fully visible without clipping on mobile").toBe(false);
  });
});
