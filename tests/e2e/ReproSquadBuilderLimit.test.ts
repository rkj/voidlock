import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("SquadBuilder Reproduction: Deployment Limit", () => {
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

  it("should fill subsequent slots when adding soldiers via Equipment Screen", async () => {
    await page.goto(E2E_URL);

    // 1. Enter Custom Mission Setup
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Go to Equipment Screen
    await page.waitForSelector("#btn-goto-equipment");
    await page.click("#btn-goto-equipment");
    await page.waitForSelector("#screen-equipment");

    // 3. Clear any existing squad members to ensure clean slate
    let currentCount = await page.evaluate(() => document.querySelectorAll(".remove-soldier-btn").length);
    console.log("Initial soldier count:", currentCount);

    while (currentCount > 0) {
      // Use evaluate to click to avoid visibility/overlay issues
      await page.evaluate(() => {
        const btn = document.querySelector(".remove-soldier-btn") as HTMLElement;
        if (btn) btn.click();
      });
      
      // Wait for count to decrease
      try {
        await page.waitForFunction((prevCount) => {
            const newCount = document.querySelectorAll(".remove-soldier-btn").length;
            return newCount < (prevCount as number);
        }, { timeout: 2000 }, currentCount);
      } catch (e) {
        console.log("Timeout waiting for removal. Current count:", await page.evaluate(() => document.querySelectorAll(".remove-soldier-btn").length));
        // Take screenshot for debug
        await page.screenshot({ path: "tests/e2e/__snapshots__/debug_repro_clear_fail.png" });
        throw e;
      }
      
      currentCount = await page.evaluate(() => document.querySelectorAll(".remove-soldier-btn").length);
      console.log("Soldier count after removal:", currentCount);
    }

    // Verify squad is empty
    const initialCount = await page.evaluate(() => {
      return document.querySelectorAll(".remove-soldier-btn").length;
    });
    expect(initialCount).toBe(0);

    // 4. Add First Soldier (Slot 0 is selected by default)
    await page.waitForSelector(".armory-panel .soldier-card");
    let cards = await page.$$(".armory-panel .soldier-card");
    if (cards.length === 0) throw new Error("No archetypes found in armory panel");
    await cards[0].click();

    // Verify 1 soldier
    currentCount = await page.evaluate(() => document.querySelectorAll(".remove-soldier-btn").length);
    expect(currentCount).toBe(1);

    // 5. Add Second Soldier
    // NO Explicit selection of next slot. Rely on Auto-Advance.
    await page.waitForSelector(".armory-panel .soldier-card");
    cards = await page.$$(".armory-panel .soldier-card");
    await cards[0].click();

    // Verify 2 soldiers (Will FAIL until fix is applied)
    currentCount = await page.evaluate(() => document.querySelectorAll(".remove-soldier-btn").length);
    expect(currentCount).toBe(2);

    // 6. Add Third Soldier
    await page.waitForSelector(".armory-panel .soldier-card");
    cards = await page.$$(".armory-panel .soldier-card");
    await cards[0].click();

    // Verify 3 soldiers
    currentCount = await page.evaluate(() => document.querySelectorAll(".remove-soldier-btn").length);
    expect(currentCount).toBe(3);

    // 7. Add Fourth Soldier
    await page.waitForSelector(".armory-panel .soldier-card");
    cards = await page.$$(".armory-panel .soldier-card");
    await cards[0].click();

    // Verify 4 soldiers
    currentCount = await page.evaluate(() => document.querySelectorAll(".remove-soldier-btn").length);
    expect(currentCount).toBe(4);

    // Take verification screenshot
    await page.screenshot({ path: "tests/e2e/__snapshots__/verified_squad_builder_4_slots.png" });
  });
});
