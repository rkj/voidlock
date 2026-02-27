import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Screen Transition Visual Continuity Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should apply screen-fade-in class and animate opacity when switching screens", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");

    const transitionCheck = await page.evaluate(async () => {
      const btn = document.getElementById("btn-menu-custom") as HTMLElement;
      const setupScreen = document.getElementById("screen-mission-setup") as HTMLElement;
      
      if (!btn || !setupScreen) return { error: "Missing elements" };
      
      btn.click();
      
      // Wait a tiny bit (20ms), opacity should be low as animation just started
      await new Promise(r => setTimeout(r, 20));
      const midOpacity = parseFloat(window.getComputedStyle(setupScreen).opacity);
      const midClass = setupScreen.classList.contains("screen-fade-in");
      
      // Wait for animation to finish (150ms + some buffer)
      await new Promise(r => setTimeout(r, 200));
      const endOpacity = parseFloat(window.getComputedStyle(setupScreen).opacity);
      
      return {
        midOpacity,
        midClass,
        endOpacity,
        display: window.getComputedStyle(setupScreen).display
      };
    });

    expect(transitionCheck.error).toBeUndefined();
    expect(transitionCheck.midClass).toBe(true);
    expect(transitionCheck.midOpacity).toBeLessThan(1);
    expect(transitionCheck.endOpacity).toBe(1);
    expect(transitionCheck.display).toBe("flex");
  });

  it("should reset and re-apply transition class when switching back and forth", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");

    const reTransitionCheck = await page.evaluate(async () => {
      const customBtn = document.getElementById("btn-menu-custom") as HTMLElement;
      const setupScreen = document.getElementById("screen-mission-setup") as HTMLElement;
      
      // 1. Go to Custom
      customBtn.click();
      await new Promise(r => setTimeout(r, 250)); // Let it finish
      
      // 2. Go back to Menu
      const backBtn = document.querySelector("#screen-mission-setup .back-button") as HTMLElement;
      if (!backBtn) return { error: "Back button not found" };
      backBtn.click();
      await new Promise(r => setTimeout(r, 250)); // Let it finish
      
      // 3. Go to Custom again
      customBtn.click();
      
      // Check immediately (20ms)
      await new Promise(r => setTimeout(r, 20));
      const midOpacity = parseFloat(window.getComputedStyle(setupScreen).opacity);
      const hasClass = setupScreen.classList.contains("screen-fade-in");
      
      return {
        midOpacity,
        hasClass
      };
    });

    expect(reTransitionCheck.error).toBeUndefined();
    expect(reTransitionCheck.hasClass).toBe(true);
    expect(reTransitionCheck.midOpacity).toBeLessThan(1);
  });
});
