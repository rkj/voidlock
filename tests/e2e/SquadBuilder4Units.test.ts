import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("SquadBuilder: 4-Unit Support Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Ensure clean state
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should allow adding up to 4 soldiers in Custom Mission Setup", async () => {
    await page.goto(E2E_URL);

    // 1. Enter Custom Mission Setup
    console.log("Entering Custom Mission Setup...");
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup");

    // 2. Clear any existing squad members
    console.log("Clearing existing squad...");
    let removes = await page.$$(".slot-remove");
    while (removes.length > 0) {
      await removes[0].click();
      await new Promise(r => setTimeout(r, 200));
      removes = await page.$$(".slot-remove");
    }

    // Verify 0 soldiers
    let squadText = await page.evaluate(() => document.getElementById("squad-total-count")?.textContent);
    console.log("Current squad count text:", squadText);
    expect(squadText).toContain("0/4");

    // 3. Add 4 soldiers using double-click
    console.log("Adding 4 soldiers...");

    for (let i = 0; i < 4; i++) {
      // Re-fetch roster cards because they might be re-rendered
      await page.waitForSelector(".roster-list .soldier-card");
      const rosterCards = await page.$$(".roster-list .soldier-card");
      if (rosterCards.length <= 0) throw new Error("No roster cards found");
      
      // Click the first available roster card (it won't be in the squad yet)
      await rosterCards[0].click({ clickCount: 2 });
      await new Promise(r => setTimeout(r, 500)); // Wait for update
    }

    // 4. Verify 4 soldiers in squad
    squadText = await page.evaluate(() => document.getElementById("squad-total-count")?.textContent);
    console.log("Final squad count text:", squadText);
    expect(squadText).toContain("4/4");

    // 5. Verify all 4 slots are occupied
    const occupiedSlots = await page.$$(".deployment-slot.occupied");
    console.log(`Occupied slots: ${occupiedSlots.length}`);
    expect(occupiedSlots.length).toBe(4);

    // 6. Verify "Launch Mission" is enabled
    const launchEnabled = await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission") as HTMLButtonElement;
        return !btn.disabled;
    });
    expect(launchEnabled).toBe(true);

    // Take screenshot
    await page.screenshot({ path: "tests/e2e/__snapshots__/squad_builder_4_units_verified.png" });
    
    // Check mobile layout
    await page.setViewport({ width: 400, height: 800 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: "tests/e2e/__snapshots__/squad_builder_4_units_mobile.png" });
  });
});
