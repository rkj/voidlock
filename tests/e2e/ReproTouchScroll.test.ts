import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Touch Scroll Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 400, height: 800, isMobile: true, hasTouch: true });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should allow touch scrolling on New Expedition screen", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    await page.waitForSelector(".campaign-setup-wizard");
    
    // Expand advanced settings
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Show Advanced Settings'));
        if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 500));

    const initialScrollTop = await page.evaluate(() => {
        const scrollContainer = document.querySelector(".campaign-setup-wizard div.overflow-y-auto");
        return scrollContainer?.scrollTop || 0;
    });

    // Perform touch scroll
    const scrollContainer = await page.$(".campaign-setup-wizard div.overflow-y-auto");
    const box = await scrollContainer?.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      await page.touchscreen.touchStart(centerX, centerY + 100);
      await page.touchscreen.touchMove(centerX, centerY - 100);
      await page.touchscreen.touchEnd();
    }

    await new Promise(r => setTimeout(r, 1000));

    const finalScrollTop = await page.evaluate(() => {
        const scrollContainer = document.querySelector(".campaign-setup-wizard div.overflow-y-auto");
        return scrollContainer?.scrollTop || 0;
    });

    console.log(`Initial: ${initialScrollTop}, Final: ${finalScrollTop}`);
    expect(finalScrollTop).toBeGreaterThan(initialScrollTop);
  });
});
