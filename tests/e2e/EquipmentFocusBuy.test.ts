import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Equipment Screen Focus Buy Reproduction", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should maintain focus after buying equipment in campaign mode", async () => {
    page.on("console", msg => {
        if (msg.text().startsWith("DEBUG:")) console.log("PAGE " + msg.text());
    });
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL);

    // 1. Start Campaign
    console.log("Waiting for Campaign menu button...");
    await page.waitForSelector("#btn-menu-campaign", { visible: true });
    await page.click("#btn-menu-campaign");

    // Wizard should be shown immediately if no campaign exists
    console.log("Waiting for Campaign Wizard (Initialize Expedition button)...");
    const startBtnSelector = '[data-focus-id="btn-start-campaign"]';
    await page.waitForSelector(startBtnSelector, { visible: true });
    await page.click(startBtnSelector);

    // Wait for Campaign Screen (Sector Map)
    console.log("Waiting for Sector Map...");
    await page.waitForSelector(".campaign-map-viewport", { visible: true });

    // 2. Inject Scrap
    await page.evaluate(() => {
      // Find the campaign key in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("voidlock_campaign_")) {
          const data = JSON.parse(localStorage.getItem(key)!);
          data.scrap = 1000;
          localStorage.setItem(key, JSON.stringify(data));
          break;
        }
      }
    });

    // 3. Click a combat node to go to Equipment Screen
    console.log("Clicking a combat node...");
    await page.waitForSelector(".campaign-node.accessible", { visible: true });
    await page.click(".campaign-node.accessible");

    // Wait for Equipment
    console.log("Waiting for Equipment Screen...");
    await page.waitForSelector(".equipment-screen", { visible: true });

    // 4. Find an unowned item in Armory
    await page.waitForSelector(".armory-item", { visible: true });

    const targetItemFocusId = await page.evaluate(() => {
        const unowned = Array.from(document.querySelectorAll(".armory-item")).find(el => {
            const price = el.querySelector(".price-cost");
            return price && price.textContent !== "Owned";
        });
        return unowned ? unowned.getAttribute("data-focus-id") : null;
    });

    expect(targetItemFocusId).not.toBeNull();
    console.log("Target Item Focus ID:", targetItemFocusId);

    // 4. Focus the item
    await page.evaluate((focusId) => {
        const el = document.querySelector(`[data-focus-id="${focusId}"]`) as HTMLElement;
        if (el) el.focus();
    }, targetItemFocusId);

    // Verify it is focused
    const isFocusedBefore = await page.evaluate((focusId) => {
        return document.activeElement?.getAttribute("data-focus-id") === focusId;
    }, targetItemFocusId);
    expect(isFocusedBefore).toBe(true);

    // 5. Buy the item (Press Enter)
    await page.keyboard.press("Enter");

    // Wait for re-render
    await new Promise(r => setTimeout(r, 500));

    // 6. Verify focus
    const focusedIdAfter = await page.evaluate(() => {
        return document.activeElement?.getAttribute("data-focus-id");
    });

    console.log("Focused ID after buy:", focusedIdAfter);

    await page.screenshot({ path: "tests/e2e/__snapshots__/focus_buy_result.png" });

    expect(focusedIdAfter).toBe(targetItemFocusId);

    // 7. Test Supply Item Focus (Standard Buy)
    console.log("Testing Supply Item Focus (Standard)...");
    const supplyPlusId = "supply-plus-mine";
    
    // Ensure it is visible and enabled
    await page.waitForSelector(`[data-focus-id="${supplyPlusId}"]:not(:disabled)`);

    await page.evaluate((focusId) => {
        const el = document.querySelector(`[data-focus-id="${focusId}"]`) as HTMLElement;
        if (el) {
            el.scrollIntoView();
            el.focus();
        }
    }, supplyPlusId);

    // Verify focus took hold
    const isSupplyFocused = await page.evaluate((focusId) => {
        return document.activeElement?.getAttribute("data-focus-id") === focusId;
    }, supplyPlusId);
    expect(isSupplyFocused).toBe(true);

    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 500));

    const focusedSupplyAfter = await page.evaluate(() => {
        return document.activeElement?.getAttribute("data-focus-id");
    });

    console.log("Focused ID after first mine buy:", focusedSupplyAfter);
    expect(focusedSupplyAfter).toBe(supplyPlusId);

    // 8. Test Supply Item Focus (Maxing Out - Fallback)
    console.log("Testing Supply Item Focus (Maxing Out)...");
    
    // Buy again (1 -> 2)
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 500));

    const focusedFinal = await page.evaluate(() => {
        return document.activeElement?.getAttribute("data-focus-id");
    });

    console.log("Focused ID after second mine buy (Maxed):", focusedFinal);
    
    // Expect fallback to minus button
    const expectedFallback = "supply-minus-mine";
    expect(focusedFinal).toBe(expectedFallback);
  });
});
