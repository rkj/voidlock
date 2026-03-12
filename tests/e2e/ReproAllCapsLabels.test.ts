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
    await page.goto(E2E_URL, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    
    // Wait for App to be ready
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // 1. Check Soldier Attributes in Equipment Screen
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-custom");
        if (btn) btn.click();
    });
    
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (btn) btn.click();
    });
    
    await page.waitForSelector("#screen-equipment", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    // The selector for "Asset Integrity Profile" in SoldierInspector
    await checkIsTitleCase("#screen-equipment h3", "Asset Integrity Profile");

    // 2. Check Debrief Screen labels (Mission Failed / Return to Command Bridge)
    // Add soldier to squad
    await page.waitForSelector(".soldier-widget-roster.clickable", { visible: true });
    await page.evaluate(() => {
        const el = document.querySelector(".soldier-widget-roster.clickable") as HTMLElement;
        if (el) el.click();
    });
    
    // Confirm Squad
    await page.waitForSelector("#screen-equipment [data-focus-id='btn-back']", { visible: true });
    await page.evaluate(() => {
        const btn = document.querySelector("#screen-equipment [data-focus-id='btn-back']") as HTMLElement;
        if (btn) btn.click();
    });

    // Launch Mission
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission");
        if (btn) btn.click();
    });
    
    await page.waitForSelector("#screen-mission", { visible: true });
    await new Promise(r => setTimeout(r, 2000));

    // Autofill deployment to enable Start Mission
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-autofill-deployment");
        if (btn) btn.click();
    });

    const startBtn = await page.waitForSelector("#btn-start-mission:not([disabled])", { visible: true });
    if (startBtn) {
        await page.evaluate(() => {
            const btn = document.getElementById("btn-start-mission");
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Toggle debug overlay via keyboard
    await page.keyboard.press("Backquote"); // (Spec 8.2)
    
    // Alternative: use evaluate if keyboard fails in headless
    await page.evaluate(() => {
        const app = (window as any).GameAppInstance;
        if (app && app.registry && app.registry.gameClient) {
            app.registry.gameClient.toggleDebugOverlay(true);
        }
    });

    await page.waitForSelector("#btn-force-lose", { visible: true, timeout: 10000 });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-force-lose");
        if (btn) btn.click();
    });
    
    await page.waitForSelector("#screen-debrief", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    // Debrief Header
    await checkIsTitleCase("#screen-debrief h1", "OPERATION CLOSED — Total Asset Loss");
    
    // Return to Operational Terminal button
    await checkIsTitleCase(".debrief-footer .debrief-button", "Return to Operational Terminal");
  });
});
