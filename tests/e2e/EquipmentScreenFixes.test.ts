import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Equipment Screen Fixes Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  async function navigateToEquipment() {
    try {
      await page.goto(E2E_URL);
      await page.evaluate(() => localStorage.clear());
      await page.goto(E2E_URL);

      // Navigate to Custom Mission
      await page.waitForSelector("#btn-menu-custom", {
        visible: true,
        timeout: 5000,
      });
      await page.click("#btn-menu-custom");

      // Navigate to Equipment Screen
      await page.waitForSelector("#btn-goto-equipment", {
        visible: true,
        timeout: 5000,
      });
      await page.click("#btn-goto-equipment");

      // Wait for Equipment Screen
      await page.waitForSelector("#screen-equipment", {
        visible: true,
        timeout: 5000,
      });
    } catch (e) {
      await page.screenshot({
        path: `tests/e2e/__snapshots__/nav_error_${Date.now()}.png`,
      });
      throw e;
    }
  }

  it("should have right-aligned prices in the Armory panel", async () => {
    await page.setViewport({ width: 1280, height: 720 });
    await navigateToEquipment();

    // Check price alignment in Armory
    const priceAlignment = await page.evaluate(() => {
      const armoryPanel = document.querySelector(".armory-panel");
      if (!armoryPanel) return { error: "Armory panel not found" };

      // Find first weapon/item with a price in Armory
      const items = Array.from(
        armoryPanel.querySelectorAll(".armory-item"),
      );
      const itemWithPrice = items.find((el) =>
        el.querySelector(".armory-item-header"),
      );
      if (!itemWithPrice)
        return { error: "No item with price found in Armory" };

      const container = itemWithPrice.querySelector(
        ".armory-item-header",
      ) as HTMLElement;
      const price = container.children[1] as HTMLElement;

      const containerRect = container.getBoundingClientRect();
      const priceRect = price.getBoundingClientRect();

      return {
        containerWidth: containerRect.width,
        priceRight: containerRect.right - priceRect.right,
        justifyBetween:
          window.getComputedStyle(container).justifyContent === "space-between",
        width100: container.style.width === "100%",
      };
    });

    console.log("Price Alignment (Armory):", priceAlignment);
    expect(priceAlignment.error).toBeUndefined();
    expect(priceAlignment.justifyBetween).toBe(true);
    expect(priceAlignment.width100).toBe(true);
    // priceRight should be very close to 0 if right-aligned
    expect(priceAlignment.priceRight).toBeLessThan(5);

    // Check price alignment in Supplies
    const suppliesAlignment = await page.evaluate(() => {
      const armoryPanel = document.querySelector(".armory-panel");
      if (!armoryPanel) return { error: "Armory panel not found" };

      // Supplies are in card class with supply-item-header
      const supplyItems = Array.from(
        armoryPanel.querySelectorAll(".supply-item-header"),
      );
      if (supplyItems.length === 0) return { error: "No supply items found" };

      const priceContainer = supplyItems[0] as HTMLElement;
      const price = priceContainer.children[1] as HTMLElement;

      const containerRect = priceContainer.getBoundingClientRect();
      const priceRect = price.getBoundingClientRect();

      return {
        containerWidth: containerRect.width,
        priceRight: containerRect.right - priceRect.right,
        justifyBetween:
          window.getComputedStyle(priceContainer).justifyContent ===
          "space-between",
        width100: priceContainer.style.width === "100%",
      };
    });

    console.log("Price Alignment (Supplies):", suppliesAlignment);
    expect(suppliesAlignment.error).toBeUndefined();
    expect(suppliesAlignment.justifyBetween).toBe(true);
    expect(suppliesAlignment.width100).toBe(true);
    expect(suppliesAlignment.priceRight).toBeLessThan(5);
  });

  it("should preserve scroll position in the Armory panel after re-render", async () => {
    // Force a small viewport to ensure scrolling is needed
    await page.setViewport({ width: 800, height: 400 });
    await navigateToEquipment();

    const scrollResults = await page.evaluate(async () => {
      const scrollContainer = document.querySelector(
        ".armory-panel .scroll-content",
      ) as HTMLElement;
      if (!scrollContainer) return { error: "Armory scroll container not found" };

      // Mark the current panel to detect re-render
      scrollContainer.dataset.isOld = "true";

      // 1. Scroll down
      scrollContainer.scrollTop = 150;
      const initialScroll = scrollContainer.scrollTop;

      // Find initial count
      const supplyRow = document.querySelector(
        ".card.flex-row.justify-between",
      ) as HTMLElement;
      const initialCount = supplyRow?.children[1]?.children[1]?.textContent;

      // 2. Trigger re-render by clicking a "-" button if count > 0, otherwise "+"
      const minusBtn = supplyRow?.children[1]?.children[0] as HTMLElement;
      const plusBtn = supplyRow?.children[1]?.children[2] as HTMLElement;

      if (parseInt(initialCount || "0") > 0) {
        minusBtn.click();
      } else {
        if (plusBtn.disabled)
          return { error: "Plus button is disabled and count is 0" };
        plusBtn.click();
      }

      // Wait a bit for re-render
      await new Promise((r) => setTimeout(r, 200));

      const newScrollContainer = document.querySelector(
        ".armory-panel .scroll-content",
      ) as HTMLElement;
      const newSupplyRow = document.querySelector(
        ".card.flex-row.justify-between",
      ) as HTMLElement;
      const finalCount = newSupplyRow?.children[1]?.children[1]?.textContent;

      return {
        initialScroll,
        finalScroll: newScrollContainer?.scrollTop,
        isNewPanel: newScrollContainer && newScrollContainer.dataset.isOld !== "true",
        countChanged: initialCount !== finalCount,
        initialCount,
        finalCount,
      };
    });

    console.log("Scroll Results:", scrollResults);
    expect(scrollResults.error).toBeUndefined();
    expect(scrollResults.initialScroll).toBeGreaterThan(0);
    expect(scrollResults.finalScroll).toBe(scrollResults.initialScroll);
    expect(scrollResults.isNewPanel).toBe(true);
    expect(scrollResults.countChanged).toBe(true);
  });
});
