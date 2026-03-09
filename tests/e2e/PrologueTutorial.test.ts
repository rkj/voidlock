// @vitest-environment node
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Prologue Tutorial E2E", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should launch prologue directly and show first advisor message", async () => {
    page.on("console", (msg) => console.log(`[BROWSER] ${msg.text()}`));
    await page.goto(E2E_URL);
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 10000 });

    // 1. Click "Campaign" on Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. Click "Initialize Expedition" (Prologue is default)
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    
    // Ensure skip prologue is not checked
    const skipChecked = await page.$eval("#campaign-skip-prologue", (el: any) => el.checked);
    expect(skipChecked).toBe(false);

    await page.click(startBtnSelector);

    // 3. Should go to Equipment Screen (Ready Room) first (ADR 0049)
    await page.waitForSelector("#screen-equipment");
    
    // Click Launch Mission
    const launchBtn = '[data-focus-id="btn-launch-mission"]';
    await page.waitForSelector(launchBtn);
    await page.click(launchBtn);

    // 4. Handle prologue_intro advisor message (narrative intro)
    const dismissBtn = ".advisor-btn[data-id='dismiss']";
    await page.waitForSelector(dismissBtn, { visible: true });
    
    const introText = await page.$eval(".advisor-text", (el) => (el as HTMLElement).innerText);
    expect(introText).toContain("The future of the project depends on this data.");
    
    await page.evaluate((selector) => {
        const btn = document.querySelector(selector) as HTMLElement;
        if (btn) btn.click();
    }, dismissBtn);
    await page.waitForSelector(".advisor-message", { hidden: true });

    // 5. Should go to Mission Screen
    await page.waitForSelector("#screen-mission", { visible: true });
    
    // 6. Wait for FIRST tutorial advisor message (start)
    await page.waitForSelector(".advisor-message", { timeout: 15000 });

    // 7. Verify HUD panels are VISIBLE (ADR 0057)
    const topBarDisplay = await page.$eval("#top-bar", (el) => window.getComputedStyle(el).display);
    const soldierPanelDisplay = await page.$eval("#soldier-panel", (el) => window.getComputedStyle(el).display);
    expect(topBarDisplay).toBe("flex");
    expect(soldierPanelDisplay).toBe("flex");

    // 8. Verify message content
    const msgText = await page.$eval(".advisor-text", (el) => (el as HTMLElement).innerText);
    expect(msgText).toContain("wake up");

    // Take screenshot for proof
    await page.screenshot({ path: "tests/e2e/__snapshots__/prologue_tutorial_start.png" });

    // 9. Dismiss and verify advisor gone
    await page.waitForSelector(dismissBtn, { visible: true });
    // Small delay for animation to finish
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate((selector) => {
        const btn = document.querySelector(selector) as HTMLElement;
        if (btn) btn.click();
    }, dismissBtn);
    await page.waitForSelector(".advisor-message", { hidden: true });
    
    const isPaused = await page.evaluate(() => {
        // We can't easily check if engine is paused from E2E without internal state access,
        // but we can check if the backdrop is gone.
        return document.querySelector(".advisor-modal-backdrop") === null;
    });
    expect(isPaused).toBe(true);
  });
});
