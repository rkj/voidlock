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

    // 3. Should go directly to Mission Screen
    await page.waitForSelector("#screen-mission");
    
    // 4. Wait for advisor message (this ensures prologue logic has run)
    await page.waitForSelector(".advisor-message", { timeout: 15000 });

    // 5. Verify HUD panels are hidden
    const topBarDisplay = await page.$eval("#top-bar", (el) => window.getComputedStyle(el).display);
    const soldierPanelDisplay = await page.$eval("#soldier-panel", (el) => window.getComputedStyle(el).display);
    expect(topBarDisplay).toBe("none");
    expect(soldierPanelDisplay).toBe("none");

    // 6. Verify message content
    const msgText = await page.$eval(".advisor-text", (el) => (el as HTMLElement).innerText);
    expect(msgText).toContain("wake up");

    // Take screenshot for proof
    await page.screenshot({ path: "tests/e2e/__snapshots__/prologue_tutorial_start.png" });

    // 7. Dismiss and verify advisor gone
    const dismissBtn = ".advisor-btn[data-id='dismiss']";
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
