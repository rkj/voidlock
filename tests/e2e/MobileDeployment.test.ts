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

    // 1. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Ensure we are using a map with spawn points (DenseShip)
    await page.waitForSelector("#map-generator-type");
    await page.select("#map-generator-type", "DenseShip");

    // 2. Go to Equipment
    await page.waitForSelector("#btn-goto-equipment");
    await page.click("#btn-goto-equipment");

    // 3. Confirm Squad (should have default 4 soldiers)
    await page.waitForSelector(".primary-button");
    const confirmBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll(".primary-button"));
      return buttons.find((b) => b.textContent === "Confirm Squad");
    });
    if (confirmBtn) {
      // @ts-ignore
      await confirmBtn.click();
    } else {
      throw new Error("Confirm Squad button not found");
    }

    // 4. Deployment Phase
    await page.waitForSelector("#screen-mission");
    await page.waitForSelector("#mobile-action-panel");
    await page.waitForSelector(".deployment-unit-item");

    // Verify units are "Pending"
    const firstUnitText = await page.$eval(".deployment-unit-item", el => el.textContent);
    expect(firstUnitText).toContain("Pending");

    // 5. Tap first unit to deploy
    await page.click(".deployment-unit-item");
    
    // Wait for state update
    await new Promise(r => setTimeout(r, 500));

    // Verify unit is now "Deployed"
    const firstUnitTextAfter = await page.$eval(".deployment-unit-item", el => el.textContent);
    expect(firstUnitTextAfter).toContain("Deployed");

    // 6. Start Mission
    // Need to deploy ALL units if they are required for start mission button to enable
    const units = await page.$$(".deployment-unit-item");
    for (let i = 1; i < units.length; i++) {
        await units[i].click();
        await new Promise(r => setTimeout(r, 100));
    }

    const startBtn = await page.waitForSelector("#btn-start-mission");
    if (!startBtn) throw new Error("Start mission button not found");
    
    const isDisabled = await startBtn.evaluate(el => (el as HTMLButtonElement).disabled);
    if (!isDisabled) {
        await startBtn.click();
        
        // 7. Verify we are in Playing state
        await page.waitForSelector(".command-menu");
    }
  });
});