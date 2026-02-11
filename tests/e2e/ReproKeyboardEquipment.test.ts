import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Repro: Keyboard Equipment Inaccessibility", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1280, height: 800 });
    // Clear state
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  const pressTab = async (count: number = 1) => {
    for (let i = 0; i < count; i++) {
      await page.keyboard.press("Tab");
      await new Promise(r => setTimeout(r, 50));
    }
  };

  const getActiveElementInfo = async () => {
    return await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return {
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        textContent: el.textContent?.trim(),
        tabIndex: (el as HTMLElement).tabIndex
      };
    });
  };

  it("should fail to focus equipment slots and armory items via keyboard", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");

    // 1. Enter Custom Mission Setup
    console.log("Entering Custom Mission Setup...");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup");

    // 2. Go to Equipment Screen
    console.log("Navigating to Equipment Screen...");
    await page.waitForSelector("#btn-goto-equipment");
    await page.click("#btn-goto-equipment");
    await page.waitForSelector(".equipment-screen");

    // 3. Select first empty slot (should be auto-selected, but let's be sure)
    // Empty slots have .menu-item.clickable class and text "[Empty Slot]"
    await page.waitForSelector(".soldier-list-panel .menu-item");
    
    // 3. Wait for Equipment Screen to render
    console.log("Waiting for Equipment Screen to render...");
    await page.waitForSelector(".equipment-screen");
    await page.waitForSelector(".soldier-list-panel .menu-item");
    await page.waitForSelector(".armory-panel .armory-item");
    await page.waitForSelector(".paper-doll-slot");

    // 4. Try to navigate to Paper Doll slots and Armory items using Tab
    console.log("Attempting to focus equipment elements via Tab...");
    
    const focusableElements = [];
    // We'll tab a lot and record what gets focus
    for (let i = 0; i < 60; i++) {
        await pressTab();
        const info = await getActiveElementInfo();
        if (info && !focusableElements.some(el => el.className === info.className && el.textContent === info.textContent)) {
            focusableElements.push(info);
            console.log(`Focused [${i}]: ${info.tagName} class="${info.className}" text="${info.textContent?.substring(0, 20)}..."`);
        }
    }

    // Check if any focusable element is a paper-doll-slot or armory-item
    const hasFocusedSlot = focusableElements.some(el => el.className && el.className.includes("paper-doll-slot"));
    const hasFocusedArmoryItem = focusableElements.some(el => el.className && el.className.includes("armory-item"));

    console.log(`Focused Slot: ${hasFocusedSlot}`);
    console.log(`Focused Armory Item: ${hasFocusedArmoryItem}`);

    // The test is to verify they ARE NOT focusable, so we expect these to be false
    expect(hasFocusedSlot, "Paper doll slots should NOT be focusable via Tab (Reproduction of bug)").toBe(false);
    expect(hasFocusedArmoryItem, "Armory items should NOT be focusable via Tab (Reproduction of bug)").toBe(false);
  }, 60000);
});
