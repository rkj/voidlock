import puppeteer, { Browser, Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { E2E_URL } from "./config";

describe("Command Menu Casing Repro (voidlock-ffdu9)", () => {
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

  test("Command menu buttons should NOT be all-caps and should NOT have text-transform: uppercase", async () => {
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    
    // Start a custom mission
    console.log("Navigating to Custom Mission...");
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.click("#btn-goto-equipment");

    // Wait for the equipment screen and add a soldier to the squad
    console.log("Adding soldier to squad...");
    await page.waitForSelector(".equipment-screen", { visible: true });
    await page.waitForSelector(".soldier-widget-roster", { visible: true });
    await page.click(".soldier-widget-roster"); // Click first soldier in roster to add to squad

    // Wait for Confirm Squad button and click it
    await page.waitForSelector("[data-focus-id='btn-confirm-squad']", { visible: true });
    await page.click("[data-focus-id='btn-confirm-squad']");

    // Launch Mission (goes to Mission Screen / Deployment Phase)
    console.log("Launching Mission...");
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");
    
    // Wait for the mission screen
    await page.waitForSelector("#screen-mission", { visible: true });
    
    // In Deployment phase, we need to click Start Mission
    console.log("Finishing Deployment...");
    await page.waitForSelector("#btn-start-mission", { visible: true });
    await page.click("#btn-start-mission");

    // Wait for the command menu to be populated (now in Playing phase)
    console.log("Waiting for Command Menu...");
    await page.waitForSelector(".command-menu", { visible: true });
    
    // We might need to wait for units to be ready
    await new Promise(r => setTimeout(r, 2000));

    // Ensure we have menu items
    await page.waitForSelector(".command-menu .menu-item", { visible: true });

    // Take screenshot of the fixed state
    await page.screenshot({ path: "screenshots/voidlock-ffdu9-fixed.png" });

    const menuItems = await page.$$(".command-menu .menu-item");
    expect(menuItems.length).toBeGreaterThan(0);

    let failures: string[] = [];

    for (const item of menuItems) {
      const text = (await page.evaluate((el) => el.textContent, item)) || "";
      const textTransform = await page.evaluate((el) => window.getComputedStyle(el).textTransform, item);

      console.log(`Menu Item: "${text}", text-transform: ${textTransform}`);

      if (text && text.trim().length > 2) {
         // Check if text is all caps
         const alphaOnly = text.replace(/[^a-zA-Z]/g, "");
         if (alphaOnly.length > 2 && alphaOnly === alphaOnly.toUpperCase()) {
            // Exceptions for abbreviations
            const exceptions = ["XP", "HP", "LOS", "LOF", "ID", "POIS", "RH", "LH", "SQD", "OBJ"];
            if (!exceptions.includes(alphaOnly)) {
                failures.push(`All-caps text found in command menu: "${text.trim()}"`);
            }
         }
      }

      if (textTransform === "uppercase") {
         failures.push(`text-transform: uppercase found in command menu item: "${text?.trim()}"`);
      }
    }
    
    // Also check breadcrumbs and title
    const title = (await page.$eval(".command-menu .menu-title", (el) => el.textContent)) || "";
    console.log(`Menu Title: "${title}"`);
    if (title && title === title.toUpperCase() && title.length > 2) {
        failures.push(`All-caps title found in command menu: "${title}"`);
    }

    if (failures.length > 0) {
        throw new Error("Repro Success: " + failures.join(" | "));
    }
  });
});
