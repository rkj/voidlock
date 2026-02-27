import { test, expect } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";

test("Strategic Screens have atmospheric backgrounds and effects", async () => {
  const page = await getNewPage();
  await page.setViewport({ width: 1024, height: 768 });

  // 1. Check Main Menu
  await page.goto(E2E_URL, { waitUntil: "load" });
  
  // Wait for splash screen to finish (Spec 8.1 / MainMenuScreen.ts 1.8s)
  await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 10000 });

  const mainMenuBg = await page.evaluate(() => {
    const el = document.getElementById("screen-main-menu");
    if (!el) return null;
    return window.getComputedStyle(el, "::before").backgroundImage;
  });
  expect(mainMenuBg).toContain("Voidlock");

  // 2. Check Engineering Screen
  await page.click("#btn-menu-engineering");
  await page.waitForSelector("#screen-engineering", { visible: true });
  const engBg = await page.evaluate(() => {
    const el = document.getElementById("screen-engineering");
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      backgroundImage: style.backgroundImage,
      hasGrain: !!el.querySelector(".grain"),
      hasScanline: !!el.querySelector(".scanline"),
      contentZIndex: (el.querySelector(".relative") as HTMLElement)?.style.zIndex
    };
  });
  expect(engBg?.backgroundImage).toContain("station.jpg");
  expect(engBg?.hasGrain).toBe(true);
  expect(engBg?.hasScanline).toBe(true);
  expect(engBg?.contentZIndex).toBe("10");

  // 3. Check Statistics Screen
  await page.evaluate(() => {
     (document.querySelector("#campaign-shell-top-bar [data-id='stats']") as HTMLElement)?.click();
  });
  await page.waitForSelector("#screen-statistics", { visible: true });
  const statsBg = await page.evaluate(() => {
    const el = document.getElementById("screen-statistics");
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      backgroundImage: style.backgroundImage,
      hasGrain: !!el.querySelector(".grain"),
      hasScanline: !!el.querySelector(".scanline")
    };
  });
  expect(statsBg?.backgroundImage).toContain("station.jpg");
  expect(statsBg?.hasGrain).toBe(true);
  expect(statsBg?.hasScanline).toBe(true);

  // 4. Check Settings Screen
  await page.evaluate(() => {
     (document.querySelector("#campaign-shell-top-bar [data-id='settings']") as HTMLElement)?.click();
  });
  await page.waitForSelector("#screen-settings", { visible: true });
  const settingsBg = await page.evaluate(() => {
    const el = document.getElementById("screen-settings");
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      backgroundImage: style.backgroundImage,
      hasGrain: !!el.querySelector(".grain"),
      hasScanline: !!el.querySelector(".scanline")
    };
  });
  expect(settingsBg?.backgroundImage).toContain("station.jpg");
  expect(settingsBg?.hasGrain).toBe(true);
  expect(settingsBg?.hasScanline).toBe(true);

  // 5. Check New Campaign Wizard
  await page.evaluate(() => {
     const backBtn = document.querySelector("#campaign-shell-top-bar .back-button") as HTMLElement;
     if (backBtn) backBtn.click();
     else {
        window.location.hash = "#main-menu";
     }
  });
  await page.waitForSelector("#btn-menu-campaign", { visible: true });
  await page.click("#btn-menu-campaign");
  await page.waitForSelector(".campaign-setup-wizard", { visible: true });
  const wizardBg = await page.evaluate(() => {
    const el = document.querySelector(".campaign-setup-wizard");
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      backgroundImage: style.backgroundImage,
      hasGrain: !!el.querySelector(".grain"),
      hasScanline: !!el.querySelector(".scanline")
    };
  });
  expect(wizardBg?.backgroundImage).toContain("Voidlock");
  expect(wizardBg?.hasGrain).toBe(true);
  expect(wizardBg?.hasScanline).toBe(true);

  await closeBrowser();
}, 60000);
