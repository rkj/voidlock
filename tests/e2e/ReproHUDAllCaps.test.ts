import puppeteer, { Browser, Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { E2E_URL } from "./config";

describe("Reproduction: HUD All-caps labels (voidlock-8ai79)", () => {
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
        return el.textContent;
    }, selector);
    
    if (text === null) {
        throw new Error(`Element ${selector} not found`);
    }
    
    expect(text).toBe(expectedText.toUpperCase());
  };

  test("HUD labels like DEPLOYMENT PHASE, START MISSION, and OBJECTIVES should be all-caps", async () => {
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });

    // Go to Mission Setup
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    
    // Select a unit to allow launching
    await page.waitForSelector("[data-focus-id='soldier-slot-0']", { visible: true });
    await page.click("[data-focus-id='soldier-slot-0']");
    await page.waitForSelector(".armory-panel .menu-item.clickable", { visible: true });
    await page.click(".armory-panel .menu-item.clickable");

    // Launch Mission (Deployment Phase)
    await page.evaluate(() => {
        const anyWindow = window as any;
        if (anyWindow.GameAppInstance) {
            anyWindow.GameAppInstance.launchMission();
        }
    });
    
    await page.waitForSelector("#screen-mission", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    // 1. Check Deployment Phase Title
    await checkIsAllCaps(".deployment-title", "DEPLOYMENT PHASE");
    
    // 2. Check Start Mission Button
    await checkIsAllCaps("#btn-start-mission", "START MISSION");
    
    // Start Mission to see Objectives
    await page.click("#btn-start-mission");
    await new Promise(r => setTimeout(r, 1000));
    
    // 3. Check Objectives Header
    await checkIsAllCaps(".objectives-status h3", "OBJECTIVES");

    // 4. Check Enemy Intel Header
    await checkIsAllCaps(".enemy-intel h3", "ENEMY INTEL");
  });
});
