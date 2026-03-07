import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Repro: Custom Empty squad launch allowed (voidlock-n4sd6)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should disable Launch Mission button in Mission Setup Screen when squad is empty in Custom mode", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Enter Custom Mission Setup
    console.log("Entering Custom Mission Setup...");
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    
    // 2. Clear existing squad
    console.log("Clearing existing squad...");
    await page.waitForSelector("#squad-builder");
    while (true) {
        const removeBtn = await page.$(".slot-remove");
        if (!removeBtn) break;
        await removeBtn.click();
        await new Promise(r => setTimeout(r, 100)); // Wait for rerender
    }

    // 3. Check if "Launch Mission" button is disabled
    console.log("Checking Launch Mission button state...");
    const launchBtn = await page.$("#btn-launch-mission");
    if (!launchBtn) {
        throw new Error("Launch Mission button not found in Mission Setup Screen");
    }

    const launchDisabled = await page.evaluate((btn) => (btn as HTMLButtonElement).disabled, launchBtn);
    console.log("Custom Mission Launch Mission disabled:", launchDisabled);

    await page.screenshot({ path: "tests/e2e/__snapshots__/n4sd6_custom_empty_squad.png" });

    // 4. Verification
    expect(launchDisabled, "Launch Mission button MUST be disabled for empty squad in Custom Mission Setup").toBe(true);
  }, 120000);
});
