import { test, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { config } from "./config";

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

test("Verify Campaign Screen Background and Effects", async () => {
  await page.goto("http://localhost:5199", { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });

  await page.waitForSelector("#btn-menu-campaign", { visible: true });
  // Bypassing splash screen pointer-events:none
  await page.evaluate(() => {
    const btn = document.getElementById("btn-menu-campaign");
    if (btn) btn.click();
  });

  await page.waitForSelector(".campaign-setup-wizard", { visible: true });
  
  const skipCheckbox = await page.$("#campaign-skip-prologue");
  if (skipCheckbox) {
    await skipCheckbox.click();
  }

  await page.click('[data-focus-id="btn-start-campaign"]');
  await page.waitForSelector(".campaign-map-viewport", { visible: true, timeout: 5000 });

  const result = await page.evaluate(() => {
    const viewport = document.querySelector(".campaign-map-viewport") as HTMLElement;
    if (!viewport) return { error: "No viewport found" };
    
    const styles = window.getComputedStyle(viewport);
    const bgImage = styles.backgroundImage;
    
    const grain = viewport.querySelector(".grain");
    const scanline = viewport.querySelector(".scanline");
    
    return {
      bgImage,
      hasGrain: !!grain,
      hasScanline: !!scanline,
    };
  });

  expect(result.bgImage).toContain("station.jpg");
  expect(result.hasGrain).toBe(true);
  expect(result.hasScanline).toBe(true);
});