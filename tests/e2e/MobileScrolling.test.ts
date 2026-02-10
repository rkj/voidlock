import { describe, it, expect, afterAll, beforeAll, beforeEach } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Scrolling Regression Test", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  beforeEach(async () => {
    // Reset to a standard mobile viewport
    await page.setViewport({
      width: 375,
      height: 667,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(E2E_URL);
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should allow scrolling in UI panels on mobile", async () => {
    // 1. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.evaluate(() => (document.getElementById("btn-menu-custom") as HTMLElement).click());

    // 2. Wait for Mission Setup screen
    await page.waitForSelector("#screen-mission-setup");
    
    // We need to ensure there is something scrollable.
    // In Mission Setup, #setup-content is scrollable on small screens.
    const scrollableSelector = "#setup-content";
    await page.waitForSelector(scrollableSelector);

    // Ensure it's actually scrollable (height of content > height of container)
    const isScrollable = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return el.scrollHeight > el.clientHeight;
    }, scrollableSelector);

    if (!isScrollable) {
       // If not scrollable, we might need to reduce viewport height even more
       await page.setViewport({
         width: 375,
         height: 300,
         isMobile: true,
         hasTouch: true,
       });
       await page.reload();
       await page.waitForSelector("#btn-menu-custom");
       await page.click("#btn-menu-custom");
       await page.waitForSelector(scrollableSelector);
    }

    const initialScrollTop = await page.evaluate((sel) => {
      return document.querySelector(sel)?.scrollTop || 0;
    }, scrollableSelector);

    // 3. Perform a touch scroll
    const rect = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, scrollableSelector);

    if (!rect) throw new Error("Could not find scrollable element");

    // Drag up to scroll down
    const startX = rect.x;
    const startY = rect.y;
    const endY = startY - 150;

    await page.touchscreen.touchStart(startX, startY);
    // Multiple moves to simulate a drag
    for (let i = 1; i <= 10; i++) {
        await page.touchscreen.touchMove(startX, startY - (i * 15));
    }
    await page.touchscreen.touchEnd();

    // Wait a bit for any momentum scroll (though preventDefault should kill it instantly if bug exists)
    await new Promise(r => setTimeout(r, 500));

    const finalScrollTop = await page.evaluate((sel) => {
      return document.querySelector(sel)?.scrollTop || 0;
    }, scrollableSelector);

    console.log(`Initial scrollTop: ${initialScrollTop}, Final scrollTop: ${finalScrollTop}`);

    // If the bug exists, finalScrollTop will be equal to initialScrollTop (0)
    // because preventDefault() on touchmove blocks scrolling.
    expect(finalScrollTop).toBeGreaterThan(initialScrollTop);
  });

  it("should still allow panning the mission map via touch", async () => {
    // 1. Start a custom mission
    await page.waitForSelector("#btn-menu-custom");
    await page.evaluate(() => (document.getElementById("btn-menu-custom") as HTMLElement).click());
    
    // Switch to Static Map and load a large map to ensure it's pannable
    await page.select("#map-generator-type", "Static");
    const largeMap = {
        width: 20,
        height: 20,
        cells: Array(400).fill({ type: 0, edges: { n: 1, e: 1, s: 1, w: 1 } })
    };
    await page.evaluate((map) => {
        const textarea = document.getElementById("static-map-json") as HTMLTextAreaElement;
        textarea.value = JSON.stringify(map);
    }, largeMap);
    await page.evaluate(() => (document.getElementById("load-static-map") as HTMLElement).click());

    await page.waitForSelector("#btn-goto-equipment");
    await page.evaluate(() => (document.getElementById("btn-goto-equipment") as HTMLElement).click());
    await page.waitForSelector("#btn-confirm-squad");
    await page.evaluate(() => (document.getElementById("btn-confirm-squad") as HTMLElement).click());

    // 2. Wait for mission to start
    await page.waitForSelector("#screen-mission");
    await page.waitForSelector("#game-canvas");
    
    const containerSelector = "#game-container";
    await page.waitForSelector(containerSelector);

    const initialScroll = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return { x: el?.scrollLeft || 0, y: el?.scrollTop || 0 };
    }, containerSelector);

    // 3. Perform a touch pan on the canvas
    const canvasRect = await page.evaluate(() => {
      const el = document.getElementById("game-canvas");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    if (!canvasRect) throw new Error("Could not find canvas");

    // Pan right and down (by dragging left and up)
    const startX = canvasRect.x;
    const startY = canvasRect.y;
    
    await page.touchscreen.touchStart(startX, startY);
    for (let i = 1; i <= 10; i++) {
        await page.touchscreen.touchMove(startX - (i * 10), startY - (i * 10));
    }
    await page.touchscreen.touchEnd();

    const finalScroll = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return { x: el?.scrollLeft || 0, y: el?.scrollTop || 0 };
    }, containerSelector);

    console.log(`Initial scroll: ${initialScroll.x}, ${initialScroll.y} | Final scroll: ${finalScroll.x}, ${finalScroll.y}`);

    expect(finalScroll.x).toBeGreaterThan(initialScroll.x);
    expect(finalScroll.y).toBeGreaterThan(initialScroll.y);
  });
});
