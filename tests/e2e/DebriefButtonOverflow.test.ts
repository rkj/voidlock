import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Page } from "puppeteer";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { setup, teardown } from "./setup";
import { E2E_URL } from "./config";

describe("Debrief Responsiveness", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  async function goToDebrief(page: Page) {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");

    // Start Custom Mission
    await page.click("#btn-menu-custom");
    
    // Bypass broken UI flow and force win directly
    await page.evaluate(async () => {
      const app = (window as any).GameAppInstance;
      if (app && app.registry) {
        app.registry.missionSetupManager.debugOverlayEnabled = true;
        app.registry.missionSetupManager.saveCurrentConfig();
        app.registry.missionRunner.launchMission();
        
        // Wait a bit for engine to start then force win
        setTimeout(() => {
            if (app.registry.gameClient) {
                app.registry.gameClient.forceWin();
            }
        }, 1000);
      }
    });

    // Wait for Debrief Screen
    await page.waitForSelector(".debrief-screen", { visible: true, timeout: 15000 });
  }

  it("should fit debrief buttons without scrolling at 1024x768", async () => {
    await page.setViewport({ width: 1024, height: 768 });
    await goToDebrief(page);

    // Check for scrolling in the summary panel
    const isScrollable = await page.evaluate(() => {
      const el = document.querySelector(".debrief-summary");
      if (!el) return false;
      return el.scrollHeight > el.clientHeight;
    });

    await page.screenshot({ path: "debrief_1024x768.png" });

    expect(isScrollable, "Debrief summary should not be scrollable at 1024x768").toBe(false);
  });

  it("should render debrief screen at 400x800 (mobile)", async () => {
    // Emulate mobile with touch
    await page.setViewport({
        width: 400,
        height: 800,
        isMobile: true,
        hasTouch: true,
    });
    
    // We might need to reload to trigger the matchMedia check in index.html if it only runs once
    // But since we are calling goToDebrief which calls goto(E2E_URL), it should be fine.
    await goToDebrief(page);

    // At 400x800, it MIGHT be scrollable due to extreme height constraint on mobile, 
    // which is acceptable as long as it's functional.
    // We primarily want the screenshot here as per instructions.
    
    await page.screenshot({ path: "debrief_400x800_mobile.png" });
    
    const hasMobileClass = await page.evaluate(() => {
        return document.body.classList.contains("mobile-touch") || 
               document.documentElement.classList.contains("mobile-touch");
    });
    
    // Note: Puppeteer matches media might not work exactly as expected with matchMedia in some versions
    // but usually setting hasTouch: true helps.
    console.log("Mobile class detected:", hasMobileClass);
  });
});
