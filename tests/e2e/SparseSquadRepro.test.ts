import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("SquadBuilder Sparse Array Reproduction", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should handle sparse squad arrays without crashing", async () => {
    await page.goto(E2E_URL);

    // 1. Enter Custom Mission Setup
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Go to Equipment Screen
    await page.waitForSelector("#btn-goto-equipment");
    await page.click("#btn-goto-equipment");
    await page.waitForSelector("#screen-equipment");

    // 3. Clear squad
    let currentCount = await page.evaluate(() => document.querySelectorAll(".remove-soldier-btn").length);
    while (currentCount > 0) {
      await page.evaluate(() => {
        const btn = document.querySelector(".remove-soldier-btn") as HTMLElement;
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 500)); // Simple wait
      currentCount = await page.evaluate(() => document.querySelectorAll(".remove-soldier-btn").length);
    }

    // 4. Add Soldier to Slot 0
    await page.waitForSelector(".armory-panel .soldier-card");
    let cards = await page.$$(".armory-panel .soldier-card");
    if (cards.length === 0) throw new Error("No archetypes");
    await cards[0].click();

    // 5. Add Soldier to Slot 2 (Skip Slot 1)
    // Select Slot 2
    await page.waitForSelector('[data-focus-id="soldier-slot-2"]');
    await page.click('[data-focus-id="soldier-slot-2"]');
    
    // Click archetype
    await page.waitForSelector(".armory-panel .soldier-card");
    cards = await page.$$(".armory-panel .soldier-card");
    await cards[0].click();

    // Verify 2 soldiers in Equipment Screen (Slot 0 and Slot 2)
    // We expect Slot 1 to be empty.
    const slot1Text = await page.evaluate(() => {
        const slot = document.querySelector('[data-focus-id="soldier-slot-1"]');
        return slot ? slot.textContent : "";
    });
    expect(slot1Text).toContain("[Empty Slot]");

    // 6. Go Back to Mission Setup (SquadBuilder)
    await page.click('[data-focus-id="btn-confirm-squad"]'); // "Confirm Squad" calls onSave which updates app and goes back to Mission Setup
    
    // 7. Verify Mission Setup loaded (check for "Total Soldiers")
    // If SquadBuilder crashed, this might timeout or show error.
    await page.waitForSelector("#squad-total-count", { timeout: 5000 });
    
    const totalText = await page.$eval("#squad-total-count", el => el.textContent);
    console.log("Total Text:", totalText);
    
    // If it didn't crash, we good?
    // We want to verify it rendered the soldiers.
    const renderedSlots = await page.$$(".deployment-slot.occupied");
    // With [A, empty, B], SquadBuilder might filter out empty?
    // If it filters, we should see 2 occupied slots.
    expect(renderedSlots.length).toBe(2);
  });
});
