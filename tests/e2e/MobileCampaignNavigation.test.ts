import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Campaign Navigation", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Emulate mobile device
    await page.setViewport({ width: 400, height: 800, isMobile: true, hasTouch: true });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should display Main Menu button within viewport on mobile", async () => {
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

    // Wait for Campaign Shell
    await page.waitForSelector("#campaign-shell-top-bar");

    // Check Main Menu button visibility
    // The button text is "Main Menu"
    const mainMenuBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.find(b => b.textContent === "Main Menu");
    });
    
    // Check nav width
    const nav = await page.$(".shell-tabs");
    const navBox = await nav?.boundingBox();
    if (navBox) {
        console.log(`Nav box: x=${navBox.x}, y=${navBox.y}, w=${navBox.width}, h=${navBox.height}`);
        expect(navBox.width).toBeGreaterThan(50); // Should have some width
    }

    expect(mainMenuBtn).toBeTruthy();

    if (mainMenuBtn) {
        const box = await mainMenuBtn.boundingBox();
        expect(box).toBeTruthy();
        if (box) {
            console.log(`Main Menu Button box: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`);
            // Check if it is within 400px width
            expect(box.x + box.width).toBeLessThanOrEqual(400);
            expect(box.x).toBeGreaterThanOrEqual(0);
        }
    }
  });

  it("should allow accessing all tabs on mobile", async () => {
      // Check if tabs container exists
      const tabsContainer = await page.$(".shell-tabs");
      expect(tabsContainer).toBeTruthy();

      // Check if "Settings" tab exists
      const settingsTab = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll(".tab-button"));
          return btns.find(b => b.textContent === "Settings");
      });
      expect(settingsTab).toBeTruthy();

      // Ensure we can click it (scrolling might be needed)
      // If it's off-screen, click might fail or scroll automatically.
      // We want to ensure it's accessible.
      await settingsTab.click();
      
      // Verify we switched to Settings tab
      // The content area should change. 
      // Or check active class on tab.
      const isActive = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll(".tab-button"));
          const btn = btns.find(b => b.textContent === "Settings");
          return btn?.classList.contains("active");
      });
      expect(isActive).toBe(true);
  });
});
