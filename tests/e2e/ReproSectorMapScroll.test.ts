import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Sector Map Scroll Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Emulate mobile device
    await page.setViewport({ width: 400, height: 800, isMobile: true, hasTouch: true });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should allow touch scrolling on Sector Map", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Start Campaign to get to Sector Map
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // Click "Start Campaign" in Wizard
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // Wait for Sector Map
    await page.waitForSelector(".campaign-map-viewport");
    
    // Check initial scroll position
    const initialScrollTop = await page.evaluate(() => {
        const viewport = document.querySelector(".campaign-map-viewport");
        return viewport?.scrollTop || 0;
    });

    console.log(`Initial ScrollTop: ${initialScrollTop}`);

    // Perform touch scroll (swipe up to scroll down)
    const viewport = await page.$(".campaign-map-viewport");
    const box = await viewport?.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      // Swipe up
      await page.touchscreen.touchStart(centerX, centerY + 200);
      await page.touchscreen.touchMove(centerX, centerY - 200);
      await page.touchscreen.touchEnd();
    }

    await new Promise(r => setTimeout(r, 1000));

    const finalScrollTop = await page.evaluate(() => {
        const viewport = document.querySelector(".campaign-map-viewport");
        return viewport?.scrollTop || 0;
    });

    console.log(`Final ScrollTop: ${finalScrollTop}`);

    // Expect scroll to have happened (might not if content fits, but we saw scrollHeight > clientHeight)
    // Wait, if scrollHeight (688) is barely larger than clientHeight (612), 
    // a small swipe might reach the end.
    // But 200px swipe should definitely move it.
    
    expect(finalScrollTop).not.toBe(initialScrollTop);
  });
});
