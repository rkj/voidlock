import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Repro: Empty squad launch allowed (voidlock-n4sd6)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should disable Launch Mission button in Equipment Screen when squad is empty in Campaign", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Start Campaign
    console.log("Starting Campaign...");
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");
    
    // Select difficulty (e.g., Simulation)
    await page.waitForSelector(".difficulty-card");
    await page.click(".difficulty-card");

    // Skip Prologue to allow removing soldiers
    await page.waitForSelector("#campaign-skip-prologue");
    await page.click("#campaign-skip-prologue");
    
    // Start
    await page.waitForSelector("[data-focus-id='btn-start-campaign']");
    await page.click("[data-focus-id='btn-start-campaign']");

    // 2. We should be at Sector Map. We need to select a node.
    console.log("Selecting a node on Sector Map...");
    await page.waitForSelector(".campaign-node.accessible", { visible: true, timeout: 5000 });
    await page.click(".campaign-node.accessible");

    console.log("Waiting for Equipment Screen...");
    await page.waitForSelector(".equipment-screen", { visible: true, timeout: 5000 });

    // 3. Remove all soldiers
    console.log("Removing soldiers...");
    while (true) {
        const removeBtn = await page.$(".remove-soldier-btn");
        if (!removeBtn) break;
        await removeBtn.click();
        await new Promise(r => setTimeout(r, 100)); // Wait for rerender
    }

    // 4. Check if "Launch Mission" button is disabled
    console.log("Checking Launch Mission button state...");
    const launchBtn = await page.$("[data-focus-id='btn-launch-mission']");
    if (!launchBtn) {
        throw new Error("Launch Mission button not found in Equipment Screen");
    }

    const launchDisabled = await page.evaluate((btn) => (btn as HTMLButtonElement).disabled, launchBtn);
    console.log("Campaign Equipment Launch Mission disabled:", launchDisabled);

    await page.screenshot({ path: "tests/e2e/__snapshots__/n4sd6_campaign_empty_squad.png" });

    // 5. This is the reproduction of the bug: button is NOT disabled
    expect(launchDisabled, "Launch Mission button MUST be disabled for empty squad in Equipment Screen").toBe(true);
  }, 120000);
});
