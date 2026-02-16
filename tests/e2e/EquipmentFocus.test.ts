import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Equipment Focus Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  async function navigateToEquipment() {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL);

    // Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");

    // Navigate to Equipment Screen
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.click("#btn-goto-equipment");

    // Wait for Equipment Screen
    await page.waitForSelector("#screen-equipment", { visible: true });
  }

  async function navigateToCampaignEquipment() {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL);

    // Start New Campaign
    await page.waitForSelector("#btn-menu-campaign", { visible: true });
    await page.click("#btn-menu-campaign");

    // Click "Start Campaign" in wizard
    await page.waitForSelector(".primary-button", { visible: true });
    await page.click(".primary-button");

    // Wait for Campaign Screen (Sector Map)
    await page.waitForSelector(".campaign-screen", { visible: true });

    // Inject scrap to afford supplies
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
    // Force a save/update or just continue (next action will reload state?)
    // CampaignManager loads on start. If we modify localStorage, we need to force reload or rely on next action?
    // Actually, CampaignManager has the state in memory. Modifying localStorage WON'T update memory.
    // We MUST reload the page to pick up localStorage changes.
    await page.reload();
    await page.waitForSelector(".campaign-screen", { visible: true });

    // Click a combat node to go to Mission Setup (Equipment Screen)
    await page.waitForSelector(".campaign-node.accessible", { visible: true });
    await page.click(".campaign-node.accessible");

    // Wait for Equipment Screen
    await page.waitForSelector("#screen-equipment", { visible: true });
  }

  it("should maintain focus after buying equipment using keyboard in Custom Mission", async () => {
    await page.setViewport({ width: 1280, height: 720 });
    await navigateToEquipment();

    // 1. Find an item in the armory that is not equipped
    const targetItemFocusId = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(".armory-panel .clickable:not(.active):not(.disabled)")) as HTMLElement[];
        if (items.length === 0) return null;
        return items[0].getAttribute("data-focus-id");
    });

    expect(targetItemFocusId).not.toBeNull();
    console.log(`Targeting custom item: ${targetItemFocusId}`);

    // 2. Focus the item
    await page.focus(`[data-focus-id="${targetItemFocusId}"]`);
    
    // Verify it is focused
    const initialFocusedId = await page.evaluate(() => document.activeElement?.getAttribute("data-focus-id"));
    expect(initialFocusedId).toBe(targetItemFocusId);

    // 3. Press Enter to buy/equip
    await page.keyboard.press("Enter");

    // Wait for re-render
    await new Promise(r => setTimeout(r, 500));

    // 4. Verify focus is still on the item
    const finalFocusedId = await page.evaluate(() => document.activeElement?.getAttribute("data-focus-id"));
    
    // Take a screenshot for proof
    await page.screenshot({ path: "tests/e2e/__snapshots__/equipment_focus_custom_repro.png" });

    expect(finalFocusedId).toBe(targetItemFocusId);
  });

  it("should handle focus fallback when supply item becomes disabled (maxed out) in Campaign Mode", async () => {
    await page.setViewport({ width: 1280, height: 720 });
    await navigateToCampaignEquipment();
    
    // 1. Find Mine (starts at 0)
    const supplyPlusId = "supply-plus-mine";
    await page.waitForSelector(`[data-focus-id="${supplyPlusId}"]`);
    await page.waitForSelector(`[data-focus-id="${supplyPlusId}"]`);

    // 2. Focus +
    await page.evaluate((focusId) => {
        const el = document.querySelector(`[data-focus-id="${focusId}"]`) as HTMLElement;
        if (el) {
            el.scrollIntoView();
            el.focus();
        }
    }, supplyPlusId);

    // 3. Buy (0 -> 1)
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 500));

    // Verify focus stays on +
    let activeId = await page.evaluate(() => document.activeElement?.getAttribute("data-focus-id"));
    expect(activeId).toBe(supplyPlusId);

    // 4. Buy (1 -> 2) [Maxes out, becomes disabled]
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 500));

    // Verify focus moves to - (Fallback)
    activeId = await page.evaluate(() => document.activeElement?.getAttribute("data-focus-id"));
    expect(activeId).toBe("supply-minus-mine");
  });
});
