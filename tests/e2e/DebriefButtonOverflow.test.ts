import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Debrief Screen Button Overflow Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should detect button overflow on Debrief Screen at 1024x768", async () => {
    await page.goto(E2E_URL);

    // 1. Enter Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Launch Mission
    await page.evaluate(() => {
        console.log("GameAppInstance keys:", Object.keys(window.GameAppInstance || {}));
        // @ts-ignore
        if (window.GameAppInstance) {
            // @ts-ignore
            window.GameAppInstance.launchMission();
        }
    });

    // 3. Force Win to get to Debrief screen
    await page.evaluate(async () => {
        // @ts-ignore
        const app = window.GameAppInstance;
        if (app && app.context && app.context.gameClient) {
            app.context.gameClient.forceWin();
        }
    });

    // 4. Wait for Debrief Screen
    await page.waitForSelector("#screen-debrief", { visible: true });
    
    // Give it a moment to render
    await new Promise(r => setTimeout(r, 500));

    // 5. Check for overflow in debrief-footer
    const overflowInfo = await page.evaluate(() => {
      const summary = document.querySelector(".debrief-summary");
      const footer = document.querySelector(".debrief-footer");
      if (!summary || !footer) return { error: "elements not found" };

      const buttons = Array.from(footer.querySelectorAll("button"));
      const buttonInfo = buttons.map(btn => ({
        text: btn.textContent,
        clientWidth: btn.clientWidth,
        scrollWidth: btn.scrollWidth,
        isOverflowing: btn.scrollWidth > btn.clientWidth
      }));

      return {
        summaryWidth: summary.clientWidth,
        summaryScrollWidth: summary.scrollWidth,
        footerWidth: footer.clientWidth,
        footerScrollWidth: footer.scrollWidth,
        isSummaryOverflowing: summary.scrollWidth > summary.clientWidth,
        isFooterOverflowing: footer.scrollWidth > footer.clientWidth,
        buttonInfo
      };
    });

    // Capture screenshot for visual proof
    await page.screenshot({
      path: "tests/e2e/__snapshots__/debrief_button_overflow_repro_1024x768.png",
      fullPage: true
    });

    console.log("Overflow Info:", JSON.stringify(overflowInfo, null, 2));

    // ASSERTION: Either summary or footer should be overflowing
    const info = overflowInfo as any;
    const hasOverflow = info.isSummaryOverflowing || info.isFooterOverflowing || info.buttonInfo.some((b: any) => b.isOverflowing);
    expect(hasOverflow).toBe(true);
  });
});
