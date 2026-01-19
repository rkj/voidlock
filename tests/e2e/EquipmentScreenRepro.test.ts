import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";

describe("Equipment Screen Layout Clipping Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should reproduce layout clipping on the Equipment Screen at small viewports", async () => {
    // 1. Set a small viewport where clipping is expected
    await page.setViewport({ width: 600, height: 400 });
    
    await page.goto("http://localhost:5173");
    
    // 2. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    
    // 3. Wait for Mission Setup screen and click "Equipment & Supplies"
    await page.waitForSelector("#btn-goto-equipment");
    await page.click("#btn-goto-equipment");
    
    // 4. Wait for Equipment Screen
    await page.waitForSelector("#screen-equipment");
    
    // 5. Take a screenshot for visual verification
    await page.screenshot({ path: "tests/e2e/__snapshots__/equipment_screen_clipping_repro.png" });
    
    // 6. Check for horizontal and vertical clipping
    const clippingStats = await page.evaluate(() => {
      const screen = document.getElementById("screen-equipment");
      if (!screen) return { error: "Screen not found" };

      const panels = Array.from(screen.querySelectorAll(".panel"));
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const panelStats = panels.map(p => {
        const rect = p.getBoundingClientRect();
        return {
          title: p.querySelector(".panel-title")?.textContent,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          isOffScreenX: rect.right > viewportWidth || rect.left < 0,
          isOffScreenY: rect.bottom > viewportHeight || rect.top < 0
        };
      });

      // Try to find the footer - it's a direct child of screen-equipment
      const footer = screen.querySelector(".flex-row.justify-end.p-10.gap-10") as HTMLElement;
      const footerRect = footer?.getBoundingClientRect();
      const isFooterInViewport = footerRect ? (
        footerRect.bottom <= viewportHeight && 
        footerRect.top >= 0 &&
        footerRect.right <= viewportWidth &&
        footerRect.left >= 0
      ) : false;

      const shell = document.getElementById("screen-campaign-shell");
      const shellRect = shell?.getBoundingClientRect();

      return {
        panelStats,
        viewportWidth,
        viewportHeight,
        isFooterInViewport,
        footerRect: footerRect ? { top: footerRect.top, bottom: footerRect.bottom, left: footerRect.left, right: footerRect.right } : null,
        shellRect: shellRect ? { top: shellRect.top, bottom: shellRect.bottom, height: shellRect.height } : null,
        screenRect: screen.getBoundingClientRect().toJSON()
      };
    });

    console.log("Clipping Stats:", JSON.stringify(clippingStats, null, 2));

    // ASSERTION: We expect NO clipping. 
    // These will fail today, reproducing the bug.
    expect(clippingStats.isFooterInViewport, "Footer is clipped/off-screen").toBe(true);
    
    const somePanelOffScreenX = clippingStats.panelStats?.some(p => p.isOffScreenX);
    expect(somePanelOffScreenX, "One or more panels are clipped horizontally").toBe(false);
  });
});
