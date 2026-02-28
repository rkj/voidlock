import puppeteer, { Browser, Page } from "puppeteer";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { E2E_URL } from "./config";

describe("Equipment Screen Squad Size E2E", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("should allow selecting 4 soldiers in a new campaign", async () => {
    try {
      await page.goto(E2E_URL, { waitUntil: "load" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "load" });

      // Wait for Main Menu to be ready (after potential splash)
      await page.waitForSelector('#btn-menu-campaign', { visible: true, timeout: 10000 });
      
      // Wait a bit more for the splash animation to definitely clear and content to be interactive
      await new Promise(r => setTimeout(r, 2000));

      // 1. Click Campaign in Main Menu
      console.log("Clicking Campaign button...");
      await page.click('#btn-menu-campaign');

      // 2. New Campaign Wizard should be visible.
      const startBtnSelector = ".campaign-setup-wizard .primary-button";
      console.log(`Waiting for wizard start button: ${startBtnSelector}`);
      await page.waitForSelector(startBtnSelector, { visible: true, timeout: 10000 });
      
      // Select difficulty 'Simulation' (first card) to ensure plenty of scrap/easy roster
      const diffCards = await page.$$(".difficulty-card");
      if (diffCards.length > 0) {
        await diffCards[0].click(); // Easy/Simulation
      }

      await page.click(startBtnSelector);

      // 3. Wait for Campaign Screen (Sector Map)
      console.log("Waiting for campaign screen...");
      await page.waitForSelector(".campaign-screen", { timeout: 10000 });

      // 4. Click the first accessible node
      console.log("Clicking first node...");
      const nodeSelector = ".campaign-node.accessible";
      await page.waitForSelector(nodeSelector, { visible: true, timeout: 10000 });
      await page.click(nodeSelector);

      // 5. Should now be in Equipment Screen (Ready Room)
      console.log("Waiting for equipment screen...");
      await page.waitForSelector(".equipment-screen", { timeout: 10000 });

      // 6. Verify 4 slots are present in the soldier list panel
      // In EquipmentScreen.ts, slots have data-focus-id="soldier-slot-0", etc.
      const slots = await page.$$(".soldier-list-panel [data-focus-id^='soldier-slot-']");
      console.log(`Found ${slots.length} squad slots`);
      
      // Take screenshot of the state
      await page.screenshot({ path: "tests/e2e/__snapshots__/equipment_squad_size_1024.png" });
      
      expect(slots.length).toBe(4);

      // Mobile Viewport Check
      await page.setViewport({ width: 400, height: 800 });
      await new Promise(r => setTimeout(r, 1000)); // Let layout settle
      await page.screenshot({ path: "tests/e2e/__snapshots__/equipment_squad_size_mobile.png" });

      // 7. Verify we can select the 4th slot
      await page.click("[data-focus-id='soldier-slot-3']");
      
      // Verify recruitment is possible for that slot
      // Recruitment panel should show archetypes or roster
      const rosterOrRecruit = await page.evaluate(() => {
        const panel = document.querySelector(".armory-panel");
        return panel ? panel.textContent : "Not found";
      });
      console.log("Right panel content:", rosterOrRecruit?.substring(0, 100) + "...");
      
      // The EquipmentScreen shows "Reserve Roster", "Recruitment", or "Armory"
      expect(rosterOrRecruit).toMatch(/Roster|Recruit|Armory/);

    } catch (err) {
      console.error("Test failed:", err);
      await page.screenshot({ path: "tests/e2e/__snapshots__/equipment_squad_size_error.png" });
      throw err;
    }
  }, 60000);
});
