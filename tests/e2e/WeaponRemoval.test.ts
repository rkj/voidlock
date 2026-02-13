import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Weapon Removal Verification", () => {
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

  it("should not have a remove button for the primary weapon (Right Hand)", async () => {
    await page.setViewport({ width: 1024, height: 768 });
    await navigateToEquipment();

    // Select the first soldier slot to ensure the inspector is populated
    await page.waitForSelector("[data-focus-id^=\"soldier-slot-\"]", { visible: true });
    await page.click("[data-focus-id^=\"soldier-slot-\"]");

    // Check for the Right Hand slot remove button
    const removeBtnStatus = await page.evaluate(() => {
      // Find the slot labeled "Right Hand"
      const slots = Array.from(document.querySelectorAll(".paper-doll-slot"));
      const rhSlot = slots.find(s => s.querySelector(".slot-title")?.textContent === "Right Hand");
      
      if (!rhSlot) return { error: "Right Hand slot not found" };
      
      const removeBtn = rhSlot.querySelector(".slot-remove-btn");
      if (!removeBtn) return { found: false };

      // Check if it's hidden or disabled (though it's a div, so disabled attribute might not apply unless we use it)
      const style = window.getComputedStyle(removeBtn);
      const isHidden = style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
      
      return { 
        found: true, 
        isHidden,
        className: removeBtn.className
      };
    });

    console.log("Remove Button Status (RH):", removeBtnStatus);
    
    expect(removeBtnStatus.error).toBeUndefined();
    // We expect the button to NOT be found or be hidden
    expect(removeBtnStatus.found === false || removeBtnStatus.isHidden === true).toBe(true);

    // Check for the Left Hand slot remove button
    const removeBtnStatusLH = await page.evaluate(() => {
      // Find the slot labeled "Left Hand"
      const slots = Array.from(document.querySelectorAll(".paper-doll-slot"));
      const lhSlot = slots.find(s => s.querySelector(".slot-title")?.textContent === "Left Hand");
      
      if (!lhSlot) return { error: "Left Hand slot not found" };
      
      const removeBtn = lhSlot.querySelector(".slot-remove-btn");
      if (!removeBtn) return { found: false };

      const style = window.getComputedStyle(removeBtn);
      const isHidden = style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
      
      return { 
        found: true, 
        isHidden,
        className: removeBtn.className
      };
    });

    console.log("Remove Button Status (LH):", removeBtnStatusLH);
    expect(removeBtnStatusLH.error).toBeUndefined();
    expect(removeBtnStatusLH.found === false || removeBtnStatusLH.isHidden === true).toBe(true);

    // Equip a Body item to verify its remove button
    await page.waitForSelector(".armory-item", { visible: true });
    await page.evaluate(() => {
      const armoryItems = Array.from(document.querySelectorAll(".armory-item")) as HTMLElement[];
      const armorItem = armoryItems.find(i => i.textContent?.includes("Light Recon") || i.textContent?.includes("Plate"));
      if (armorItem) armorItem.click();
    });
    // Wait for render
    await new Promise(r => setTimeout(r, 200));

    // Verify that Body slot STILL has a remove button
    const removeBtnStatusBody = await page.evaluate(() => {
      // Find the slot labeled "Body"
      const slots = Array.from(document.querySelectorAll(".paper-doll-slot"));
      const bodySlot = slots.find(s => s.querySelector(".slot-title")?.textContent === "Body");
      
      if (!bodySlot) return { error: "Body slot not found" };
      
      const removeBtn = bodySlot.querySelector(".slot-remove-btn");
      if (!removeBtn) return { found: false };

      const style = window.getComputedStyle(removeBtn);
      const isVisible = style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      
      return { 
        found: true, 
        isVisible,
        className: removeBtn.className
      };
    });

    console.log("Remove Button Status (Body):", removeBtnStatusBody);
    expect(removeBtnStatusBody.error).toBeUndefined();
    expect(removeBtnStatusBody.found).toBe(true);
    expect(removeBtnStatusBody.isVisible).toBe(true);
  });
});
