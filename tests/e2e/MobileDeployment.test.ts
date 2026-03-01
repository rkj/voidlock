import { describe, it, expect, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";
import { KnownDevices } from "puppeteer";

describe("Mobile Deployment Flow", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  it("should deploy units via tapping in mobile-action-panel", async () => {
    const page = await getNewPage();
    await page.emulate(KnownDevices["iPhone 12"]);
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for App to be ready
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // 1. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-custom");
        if (btn) btn.click();
    });

    // Ensure we are using a map with spawn points (DenseShip)
    await page.waitForSelector("#map-generator-type");
    await page.select("#map-generator-type", "DenseShip");

    // 2. Go to Equipment
    await page.waitForSelector("#btn-goto-equipment");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (btn) btn.click();
    });

    // 3. Back to Setup
    await page.waitForSelector("#screen-equipment .back-button", { visible: true });
    await page.evaluate(() => {
        const btn = document.querySelector("#screen-equipment .back-button") as HTMLElement;
        if (btn) btn.click();
    });

    // Launch
    await page.waitForSelector("#btn-launch-mission");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission");
        if (btn) btn.click();
    });

    // 4. Deployment Phase
    await page.waitForSelector("#screen-mission");
    await page.waitForSelector("#mobile-action-panel");
    await page.waitForSelector(".deployment-unit-item");

    // Verify units are "Pending"
    const firstUnitText = await page.$eval(".deployment-unit-item", el => el.textContent);
    expect(firstUnitText).toContain("Pending");

    // 5. Tap first unit to deploy (Double click required)
    await page.click(".deployment-unit-item", { clickCount: 2 });
    
    // Wait for state update
    await new Promise(r => setTimeout(r, 1000));

    // Verify unit is now "Deployed"
    const firstUnitTextAfter = await page.$eval(".deployment-unit-item", el => el.textContent);
    expect(firstUnitTextAfter).toContain("Deployed");

    // 6. Start Mission
    // Need to deploy ALL units if they are required for start mission button to enable
    const units = await page.$$(".deployment-unit-item");
    for (const unit of units) {
        await unit.click({ clickCount: 2 });
        await new Promise(r => setTimeout(r, 500));
    }

    const startBtn = await page.waitForSelector("#btn-start-mission:not([disabled])", { visible: true });
    if (!startBtn) throw new Error("Start mission button not found or remains disabled");
    
    await startBtn.click();
        
    // 7. Verify we are in Playing state
    await page.waitForSelector(".command-menu");
  });
});