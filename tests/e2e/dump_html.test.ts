import { describe, it, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";
import * as fs from "fs";

describe("Dump HTML for Asset Loadout", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should dump html", async () => {
    await page.goto(E2E_URL, { waitUntil: "load" });

    // Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Wait for Mission Setup screen
    await page.waitForSelector("#screen-mission-setup");
    
    // Go to Equipment screen
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.click("#btn-goto-equipment");

    await page.waitForSelector(".soldier-equipment-panel", { visible: true });

    const html = await page.$eval(".soldier-equipment-panel", el => el.innerHTML);
    fs.writeFileSync("dump.html", html);
  });
});
