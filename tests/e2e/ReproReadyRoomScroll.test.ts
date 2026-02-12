import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Ready Room Scroll Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 400, height: 800 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("capture ready room screen scrollability", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    await page.waitForSelector("#screen-mission-setup");
    
    const scrollMetrics = await page.evaluate(() => {
      const scrollContainer = document.querySelector("#setup-content");
      if (!scrollContainer) return { error: "No scroll container found" };
      
      const initialScrollTop = scrollContainer.scrollTop;
      scrollContainer.scrollTop = 100;
      const afterScrollTop = scrollContainer.scrollTop;
      
      return {
        scrollHeight: scrollContainer.scrollHeight,
        clientHeight: scrollContainer.clientHeight,
        initialScrollTop,
        afterScrollTop,
        isScrollable: scrollContainer.scrollHeight > scrollContainer.clientHeight
      };
    });
    console.log("Scroll Metrics:", scrollMetrics);
    
    await page.screenshot({ path: "repro_mobile_ready_room.png" });
    
    expect(scrollMetrics.isScrollable).toBe(true);
    expect(scrollMetrics.afterScrollTop).toBe(100);
  });
});
