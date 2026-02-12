import puppeteer, { Browser, Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { E2E_URL } from "./config";

describe("UI Casing Standardization (voidlock-0gxhs)", () => {
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

  const checkNoAllCaps = async (selector: string, context: string) => {
    const elements = await page.$$(selector);
    for (const el of elements) {
      const text = await page.evaluate((e) => e.textContent, el);
      if (text && text.trim().length > 2) {
        // Check if text is all caps (ignoring non-alpha characters)
        const alphaOnly = text.replace(/[^a-zA-Z]/g, "");
        if (alphaOnly.length > 2 && alphaOnly === alphaOnly.toUpperCase()) {
          // Exceptions for abbreviations
          const exceptions = ["XP", "HP", "LOS", "LOF", "ID", "POIS", "RH", "LH", "SQD", "OBJ", "VITE", "VOD", "DAG"];
          if (exceptions.includes(alphaOnly)) continue;
          
          // Failure: all caps text found
          throw new Error(`All-caps text found in ${context}: "${text.trim()}" (Selector: ${selector})`);
        }

        // Check computed style for text-transform: uppercase
        const textTransform = await page.evaluate((e) => window.getComputedStyle(e).textTransform, el);
        if (textTransform === "uppercase") {
           throw new Error(`text-transform: uppercase found in ${context}: "${text.trim()}" (Selector: ${selector})`);
        }
      }
    }
  };

  test("All screens should not have all-caps labels", async () => {
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    
    // 1. Main Menu
    await page.waitForSelector("#screen-main-menu", { visible: true });
    await checkNoAllCaps("#screen-main-menu button", "Main Menu Buttons");
    await checkNoAllCaps("#screen-main-menu label", "Main Menu Labels");

    // 2. Settings Screen
    await page.click("#btn-menu-settings");
    await page.waitForSelector("#screen-settings", { visible: true });
    await checkNoAllCaps("#screen-settings h1", "Settings Header");
    await checkNoAllCaps("#screen-settings h3", "Settings Subheaders");
    await checkNoAllCaps("#screen-settings label", "Settings Labels");
    await checkNoAllCaps("#screen-settings button", "Settings Buttons");
    await page.click(".back-button"); // Back to Menu
    await page.waitForSelector("#screen-main-menu", { visible: true });

    // 3. Mission Setup
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup", { visible: true });
    await checkNoAllCaps("#screen-mission-setup h1", "Mission Setup Header");
    await checkNoAllCaps("#screen-mission-setup label", "Mission Setup Labels");
    await checkNoAllCaps("#screen-mission-setup button", "Mission Setup Buttons");

    // 4. Equipment
    await page.click("#btn-goto-equipment");
    await page.waitForSelector("#screen-equipment", { visible: true });
    await checkNoAllCaps("#screen-equipment h2", "Equipment Headers");
    await checkNoAllCaps("#screen-equipment button", "Equipment Buttons");

    // 5. Tactical HUD
    await page.click("[data-focus-id='btn-confirm-squad']");
    await page.waitForSelector("#screen-mission-setup", { visible: true });
    await page.click("#btn-launch-mission");
    await page.waitForSelector("#screen-mission", { visible: true });
    await checkNoAllCaps("#top-bar button", "Top Bar Buttons");
    await checkNoAllCaps("#top-bar span", "Top Bar Spans");
    await checkNoAllCaps("#top-bar label", "Top Bar Labels");
    await checkNoAllCaps("#right-panel h3", "Right Panel Headers");
  });
});
