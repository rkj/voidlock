import { describe, it, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Scroll Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 400, height: 800 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("capture new expedition screen", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    await page.waitForSelector(".campaign-setup-wizard");
    
    // Expand advanced settings to make it definitely long
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Show Advanced Settings'));
        if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 500));

    await page.screenshot({ path: "repro_mobile_expedition.png" });
    
    const scrollMetrics = await page.evaluate(() => {
      const scrollContainer = document.querySelector(".campaign-setup-wizard div.overflow-y-auto");
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
    
    expect(scrollMetrics.isScrollable).toBe(true);
    expect(scrollMetrics.afterScrollTop).toBe(100);
  });
});
