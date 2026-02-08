import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Soldier Card Overlap Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Enable mobile touch emulation
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/04.1",
    );
    await page.setViewport({
      width: 375,
      height: 667,
      hasTouch: true,
      isMobile: true,
    });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should verify that the remove 'X' does not overlap with 'LVL' on soldier cards in Equipment Screen (Mobile)", async () => {
    try {
      await page.goto(E2E_URL);

      // Wait for app to load and detect mobile-touch
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("mobile-touch"),
      );

      await page.waitForSelector(".menu-button");

      // Start Simulation Setup
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const setupBtn = buttons.find((b) =>
          b.textContent?.includes("Simulation Setup"),
        );
        if (setupBtn) setupBtn.click();
      });

      await page.waitForSelector("#btn-goto-equipment");
      await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (btn) (btn as HTMLElement).click();
      });

      await page.waitForSelector(".soldier-list-panel .soldier-item");

      const positions = await page.evaluate(() => {
        const item = document.querySelector(
          ".soldier-list-panel .soldier-item",
        );
        if (!item) return null;

        const itemRect = item.getBoundingClientRect();
        const lvl = item.querySelector(".badge");
        const x = item.querySelector(".remove-soldier-btn");

        if (!lvl || !x)
          return { error: "Elements not found", lvl: !!lvl, x: !!x };

        const lvlRect = lvl.getBoundingClientRect();
        const xRect = x.getBoundingClientRect();

        const overlap = !(
          lvlRect.right < xRect.left ||
          lvlRect.left > xRect.right ||
          lvlRect.bottom < xRect.top ||
          lvlRect.top > xRect.bottom
        );

        return {
          itemWidth: itemRect.width,
          overlap,
          lvl: {
            top: lvlRect.top,
            bottom: lvlRect.bottom,
            left: lvlRect.left,
            right: lvlRect.right,
          },
          x: {
            top: xRect.top,
            bottom: xRect.bottom,
            left: xRect.left,
            right: xRect.right,
          },
        };
      });

      console.log(
        "Equipment Positions (Mobile):",
        JSON.stringify(positions, null, 2),
      );

      if (positions && !("error" in positions)) {
        expect(positions.overlap).toBe(false);
      }
    } catch (err) {
      await page.screenshot({
        path: "screenshots/equipment_overlap_error_mobile.png",
      });
      throw err;
    }
  });
});
