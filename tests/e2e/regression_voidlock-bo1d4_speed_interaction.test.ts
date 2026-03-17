import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Tutorial Speed Interaction Regression (voidlock-bo1d4)", () => {
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

  it("should allow interacting with pause button during tutorial", async () => {
    await page.goto(E2E_URL);
    
    // 1. Start Campaign
    console.log("Starting Campaign...");
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");
    
    // 2. Wizard
    console.log("In Wizard...");
    const startBtn = await page.waitForSelector('[data-focus-id="btn-start-campaign"]');
    await page.evaluate((el) => (el as HTMLElement).click(), startBtn);

    // 3. Check if we are in Sector Map or directly in Equipment
    console.log("Waiting for next screen...");
    await new Promise(r => setTimeout(r, 2000));
    let url = page.url();
    console.log("Current URL:", url);

    if (url.includes("#campaign")) {
        console.log("In Sector Map. Selecting first node...");
        const node = await page.waitForSelector(".campaign-node.accessible");
        await page.evaluate((el) => (el as HTMLElement).click(), node);
        await new Promise(r => setTimeout(r, 1000));
    }

    // 4. Equipment Screen
    console.log("In Equipment Screen...");
    const launchBtnSelector = '[data-focus-id="btn-launch-mission"]:not([disabled])';
    await page.waitForSelector(launchBtnSelector, { timeout: 10000 });
    const launchBtn = await page.$(launchBtnSelector);
    
    console.log("Launching Mission...");
    await page.evaluate((el) => (el as HTMLElement).click(), launchBtn!);

    // 5. Advisor intro
    console.log("Waiting for Advisor intro...");
    const dismissBtnSelector = ".advisor-btn[data-id='dismiss']";
    await page.waitForSelector(dismissBtnSelector, { timeout: 15000 });
    console.log("Dismissing Advisor intro.");
    await page.evaluate((el) => (el as HTMLElement).click(), await page.$(dismissBtnSelector));

    // 6. Wait for Mission Screen and Deployment
    console.log("Waiting for Mission Screen...");
    await page.waitForSelector("#screen-mission", { visible: true, timeout: 15000 });
    
    console.log("Waiting for Deployment elements...");
    const startMissionBtn = await page.waitForSelector("#btn-start-mission", { timeout: 15000 });
    
    // Auto-fill and start
    const autoFillBtn = await page.waitForSelector("#btn-autofill-deployment");
    await page.evaluate((el) => (el as HTMLElement).click(), autoFillBtn);
    await new Promise(r => setTimeout(r, 1000));
    console.log("Clicked Auto-fill. Clicking Start Mission...");
    await page.evaluate((el) => (el as HTMLElement).click(), startMissionBtn);

    // 7. Mission starts. Tutorial message (OPERATOR NOTICE) appears.
    console.log("Waiting for Advisor (OPERATOR NOTICE)...");
    await page.waitForSelector(dismissBtnSelector, { timeout: 15000 });
    console.log("Dismissing OPERATOR NOTICE.");
    // Dismiss it
    await page.evaluate((el) => (el as HTMLElement).click(), await page.$(dismissBtnSelector));

    // 8. Tutorial step 1: observe. Speed control should be dimmed.
    console.log("Checking Speed Control...");
    const speedControl = await page.waitForSelector("#speed-control.tutorial-dimmed", { timeout: 5000 });
    expect(speedControl).toBeTruthy();

    const pointerEvents = await page.evaluate((el) => {
        return window.getComputedStyle(el).pointerEvents;
    }, speedControl);
    
    console.log("Speed control pointer-events:", pointerEvents);
    
    // FIXED: It should NOT be "none" anymore
    expect(pointerEvents).not.toBe("none");

    const btnPointerEvents = await page.evaluate(() => {
        const btn = document.getElementById("btn-pause-toggle");
        if (!btn) return "none";
        return window.getComputedStyle(btn).pointerEvents;
    });
    
    console.log("Pause button pointer-events:", btnPointerEvents);
    expect(btnPointerEvents).not.toBe("none");
    
    // Final check: click it!
    console.log("Clicking Pause...");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-pause-toggle");
        btn?.click();
    });
    
    // Check if it's paused
    await new Promise(r => setTimeout(r, 1000));
    const isPaused = await page.evaluate(() => {
        const btn = document.getElementById("btn-pause-toggle");
        return btn?.textContent?.toLowerCase().includes("play");
    });
    console.log("Is paused:", isPaused);
    expect(isPaused).toBe(true);
  }, 120000);
});
