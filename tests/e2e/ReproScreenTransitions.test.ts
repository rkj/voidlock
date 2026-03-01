import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Screen Transition Visual Continuity Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("NEGATIVE PROOF: should FAIL if it expects a transition (currently static)", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");

    // We'll inject a script to click and wait for a very short time
    // If there was a transition (e.g. 150ms), at 20ms it should NOT be fully visible.
    
    const transitionCheck = await page.evaluate(async () => {
      const btn = document.getElementById("btn-menu-custom") as HTMLElement;
      const setupScreen = document.getElementById("screen-mission-setup") as HTMLElement;
      
      if (!btn || !setupScreen) return "Missing elements";
      
      btn.click();
      
      // Wait a tiny bit (20ms), well within the 150-200ms transition time
      await new Promise(r => setTimeout(r, 20));
      
      const opacity = parseFloat(window.getComputedStyle(setupScreen).opacity);
      const display = window.getComputedStyle(setupScreen).display;
      
      return {
        opacity,
        display
      };
    });

    // This expectation confirms a transition is occurring (opacity < 1 at 20ms)
    expect(transitionCheck).toMatchObject({
      display: "flex"
    });
    // @ts-ignore
    expect(transitionCheck.opacity).toBeLessThan(1);

    // If we wanted to prove it's NOT transitioning, we'd expect opacity < 1 at 20ms.
    // So let's write the test that we WANT to pass in the future, and see it fail.
  });

  it("REPRO: Transitions are now animated", async () => {
      await page.goto(E2E_URL);
      await page.waitForSelector("#btn-menu-custom");

      const results = await page.evaluate(async () => {
          const btn = document.getElementById("btn-menu-custom") as HTMLElement;
          const setupScreen = document.getElementById("screen-mission-setup") as HTMLElement;
          
          btn.click();
          // No delay, immediate check
          return {
              display: window.getComputedStyle(setupScreen).display,
              opacity: window.getComputedStyle(setupScreen).opacity
          };
      });

      expect(results.display).toBe("flex");
      expect(parseFloat(results.opacity)).toBeLessThan(1);
  });
});
