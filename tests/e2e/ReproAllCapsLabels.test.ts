import puppeteer, { Browser, Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { E2E_URL } from "./config";

describe("Reproduction: All-caps labels in UI (voidlock-8ai79)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await browser.close();
  });

  const checkIsAllCaps = async (selector: string, expectedText: string) => {
    const text = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        // Check both textContent and CSS text-transform
        const style = window.getComputedStyle(el);
        if (style.textTransform === "uppercase") {
            return el.textContent?.toUpperCase();
        }
        return el.textContent;
    }, selector);
    
    if (text === null) {
        throw new Error(`Element ${selector} not found`);
    }
    
    // We expect it to be ALL CAPS
    expect(text).toBe(expectedText.toUpperCase());
  };

  test("Labels MISSION FAILED, RETURN TO COMMAND BRIDGE, and SOLDIER ATTRIBUTES should be all-caps", async () => {
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });

    // 1. Check Soldier Attributes in Equipment Screen
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.click("#btn-goto-equipment");
    
    await page.waitForSelector("#screen-equipment", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    // The selector for "Soldier Attributes" in SoldierInspector
    await checkIsAllCaps("#screen-equipment h3", "SOLDIER ATTRIBUTES");

    // 2. Check Debrief Screen labels (MISSION FAILED / RETURN TO COMMAND BRIDGE)
    await page.click("[data-focus-id='soldier-slot-0']");
    await page.waitForSelector(".armory-panel .menu-item.clickable", { visible: true });
    await page.click(".armory-panel .menu-item.clickable");
    
    await page.evaluate(() => {
        const anyWindow = window as any;
        if (anyWindow.GameAppInstance) {
            anyWindow.GameAppInstance.launchMission();
        }
    });
    
    await page.waitForSelector("#screen-mission", { visible: true });
    await new Promise(r => setTimeout(r, 2000));

    const startBtn = await page.$("#btn-start-mission");
    if (startBtn) {
        await startBtn.click();
        await new Promise(r => setTimeout(r, 1000));
    }
    
    await page.evaluate(() => {
        const anyWindow = window as any;
        if (anyWindow.GameAppInstance && anyWindow.GameAppInstance.context && anyWindow.GameAppInstance.context.gameClient) {
            anyWindow.GameAppInstance.context.gameClient.toggleDebugOverlay(true);
        }
    });
    
    await page.waitForSelector("#btn-force-lose", { visible: true });
    await page.click("#btn-force-lose");
    
    await page.waitForSelector("#screen-debrief", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    // Debrief Header
    await checkIsAllCaps("#screen-debrief h1", "MISSION FAILED");
    
    // Return to Command Bridge button
    await checkIsAllCaps(".debrief-footer .debrief-button", "RETURN TO COMMAND BRIDGE");
  });
});
