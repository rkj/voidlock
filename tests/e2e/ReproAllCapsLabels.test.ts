import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Reproduction: Title Case labels in UI (voidlock-8ai79)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  const checkIsTitleCase = async (selector: string, expectedText: string) => {
    const text = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return el.textContent?.trim();
    }, selector);
    
    if (text === null) {
        throw new Error(`Element ${selector} not found`);
    }
    
    expect(text).toBe(expectedText);

    // Verify it's NOT forced to uppercase by CSS
    const isUppercaseCSS = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return window.getComputedStyle(el).textTransform === "uppercase";
    }, selector);
    
    expect(isUppercaseCSS).toBe(false);
  };

  test("Labels Mission Failed, Return to Command Bridge, and Soldier Attributes should be Title Case", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Check Soldier Attributes in Equipment Screen
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.click("#btn-goto-equipment");
    
    await page.waitForSelector("#screen-equipment", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    // The selector for "Soldier Attributes" in SoldierInspector
    await checkIsTitleCase("#screen-equipment h3", "Soldier Attributes");

    // 2. Check Debrief Screen labels (Mission Failed / Return to Command Bridge)
    // Add soldier to squad
    await page.waitForSelector(".soldier-widget-roster.clickable", { visible: true });
    await page.click(".soldier-widget-roster.clickable");
    
    // Confirm Squad
    const backBtn = await page.waitForSelector('[data-focus-id="btn-back"]');
    if (!backBtn) throw new Error("Back button not found");
    await backBtn.click();

    // Launch Mission
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");
    
    await page.waitForSelector("#screen-mission", { visible: true });
    await new Promise(r => setTimeout(r, 2000));

    // Autofill deployment to enable Start Mission
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.click("#btn-autofill-deployment");

    const startBtn = await page.waitForSelector("#btn-start-mission:not([disabled])", { visible: true });
    if (startBtn) {
        await startBtn.click();
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Toggle debug overlay via keyboard
    await page.keyboard.press("`"); // Some systems use backtick/~
    await page.keyboard.press("~"); 
    
    // Alternative: use evaluate if keyboard fails in headless
    await page.evaluate(() => {
        const anyWin = window as any;
        if (anyWin.GameAppInstance && anyWin.GameAppInstance.context && anyWin.GameAppInstance.context.gameClient) {
            anyWin.GameAppInstance.context.gameClient.toggleDebugOverlay(true);
        }
    });

    await page.waitForSelector("#btn-force-lose", { visible: true, timeout: 5000 });
    await page.click("#btn-force-lose");
    
    await page.waitForSelector("#screen-debrief", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    // Debrief Header
    await checkIsTitleCase("#screen-debrief h1", "Mission Failed");
    
    // Return to Command Bridge button
    await checkIsTitleCase(".debrief-footer .debrief-button", "Return to Command Bridge");
  });
});
