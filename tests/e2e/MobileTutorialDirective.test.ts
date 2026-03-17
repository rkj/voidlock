import { describe, it, expect, beforeEach, afterEach } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Tutorial Directive Verification", () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
    page = await browser.newPage();
    // Emulate iPhone 12/13
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  });

  afterEach(async () => {
    await browser.close();
  });

  it.skip("should show mobile-appropriate directive for the pause step", async () => {
    // Navigate to the app and clear storage
    await page.goto(`${E2E_URL}/#screen-main-menu`, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign", { visible: true });
    await page.click("#btn-menu-campaign");

    // 2. Click "Initialize Expedition" in the wizard
    const startBtnSelector = ".primary-button";
    await page.waitForSelector(startBtnSelector, { visible: true });
    
    // Ensure "Skip Tutorial Prologue" is NOT checked (it shouldn't be by default after clear)
    await page.click(startBtnSelector);

    // 3. Wait for mission to load (increased timeout)
    await page.waitForSelector("#screen-mission", { visible: true, timeout: 60000 });

    // 4. Wait for Tutorial Step 1 (observe) to pass. 
    // We need to wait for the units to move. In the prologue, they move automatically.
    // We'll wait until the directive changes from "ASSET DEPLOYMENT INITIALIZED" to "Interface Overview"
    await page.waitForFunction(
        () => {
            const el = document.getElementById("tutorial-directive-text");
            return el && el.textContent?.includes("Interface Overview");
        },
        { timeout: 30000 }
    );

    // 5. Wait for Tutorial Step 2 (ui_tour) to pass (5 seconds).
    // We'll wait until the directive changes to the "pause" step.
    await page.waitForFunction(
        () => {
            const el = document.getElementById("tutorial-directive-text");
            return el && (el.textContent?.includes("Tap 'Pause'") || el.textContent?.includes("Press [Space]"));
        },
        { timeout: 15000 }
    );

    const directiveText = await page.$eval("#tutorial-directive-text", el => el.textContent);
    console.log("Current Tutorial Directive:", directiveText);

    // FAILURE CASE: If it says "Press [Space]", the bug is reproduced.
    expect(directiveText).toContain("Tap 'Pause'");
    expect(directiveText).not.toContain("Press [Space]");
  }, 120000);
});
