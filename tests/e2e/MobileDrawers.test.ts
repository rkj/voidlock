import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Drawers", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Set mobile viewport
    await page.setViewport({ width: 375, height: 667, isMobile: true });
    
    await page.goto(`${E2E_URL}/#main-menu`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Wait for splash to finish
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 10000 });
    
    // Go to a custom mission
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");
    
    // Mission Deployment
    await page.waitForSelector(".deployment-summary", { visible: true });
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.click("#btn-autofill-deployment");
    await page.waitForSelector("#btn-start-mission:not(.disabled)", { visible: true });
    await page.click("#btn-start-mission");

    // Launch mission
    await page.waitForSelector("#screen-mission", { visible: true });
    await page.waitForSelector("#btn-toggle-squad", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
  }, 40000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should verify all mobile drawer behaviors in sequence", async () => {
    const clickToggle = async (selector: string) => {
        await page.waitForSelector(selector, { visible: true });
        await page.evaluate((sel) => {
            const btn = document.querySelector(sel) as HTMLElement;
            if (btn) btn.click();
        }, selector);
    };

    // 1. should show drawer toggles and hide panels by default on mobile
    const squadToggle = await page.$("#btn-toggle-squad");
    const objToggle = await page.$("#btn-toggle-right");
    
    expect(await squadToggle?.boundingBox()).not.toBeNull();
    expect(await objToggle?.boundingBox()).not.toBeNull();

    const isSquadVisible = await page.evaluate(() => {
        const el = document.getElementById("soldier-panel");
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (style.display === "none") return false;
        const matrix = new WebKitCSSMatrix(style.transform);
        return matrix.m41 === 0; // Not translated
    });
    expect(isSquadVisible).toBe(false);

    // 2. should toggle Squad drawer
    await clickToggle("#btn-toggle-squad");
    await new Promise(r => setTimeout(r, 1000));

    const isSquadVisibleNow = await page.evaluate(() => {
        const el = document.getElementById("soldier-panel");
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const matrix = new WebKitCSSMatrix(style.transform);
        return matrix.m41 === 0;
    });
    expect(isSquadVisibleNow).toBe(true);

    // Toggle off
    await clickToggle("#btn-toggle-squad");
    await new Promise(r => setTimeout(r, 1000));

    // 3. should toggle Objectives drawer
    await clickToggle("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 1000));

    const isRightVisible = await page.evaluate(() => {
        const el = document.getElementById("right-panel");
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const matrix = new WebKitCSSMatrix(style.transform);
        return matrix.m41 === 0;
    });
    expect(isRightVisible).toBe(true);

    // Toggle off
    await clickToggle("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 1000));

    // 4. should close one drawer when opening another
    await clickToggle("#btn-toggle-squad");
    await new Promise(r => setTimeout(r, 1000));
    
    await clickToggle("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 1000));

    const isSquadVisibleFinal = await page.evaluate(() => {
        const el = document.getElementById("soldier-panel");
        const style = window.getComputedStyle(el!);
        const matrix = new WebKitCSSMatrix(style.transform);
        return matrix.m41 === 0;
    });
    expect(isSquadVisibleFinal).toBe(false);

    const isRightVisibleFinal = await page.evaluate(() => {
        const el = document.getElementById("right-panel");
        const style = window.getComputedStyle(el!);
        const matrix = new WebKitCSSMatrix(style.transform);
        return matrix.m41 === 0;
    });
    expect(isRightVisibleFinal).toBe(true);

    // 5. should close drawers when clicking game area
    await page.evaluate(() => {
      const container = document.getElementById("game-container");
      if (container) container.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    const isAnyVisible = await page.evaluate(() => {
        const s = document.getElementById("soldier-panel");
        const r = document.getElementById("right-panel");
        const sm = new WebKitCSSMatrix(window.getComputedStyle(s!).transform);
        const rm = new WebKitCSSMatrix(window.getComputedStyle(r!).transform);
        return sm.m41 === 0 || rm.m41 === 0;
    });
    expect(isAnyVisible).toBe(false);

    // 6. should be able to change speed via mobile mission controls
    await clickToggle("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 1000));

    const speedValue = await page.$eval("#speed-value", el => el.textContent);
    
    await page.evaluate(() => {
      const slider = document.querySelector(".mobile-speed-slider") as HTMLInputElement;
      if (slider) {
        slider.value = "100";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    await new Promise(r => setTimeout(r, 1000));
    const mobileSpeedValue = await page.$eval(".mobile-speed-value", el => el.textContent);
    expect(mobileSpeedValue).not.toBe(speedValue);
    await page.screenshot({ path: "screenshots/mobile_speed_sync_playing.png" });

    // 7. should not have Top Bar overflow on mobile
    await page.waitForSelector("#top-bar", { visible: true });
    const topBar = await page.$("#top-bar");
    const topBarBox = await topBar?.boundingBox();
    if (topBarBox) {
        expect(topBarBox.width).toBeLessThanOrEqual(375.5);
    }

    // 8. should be able to abort mission via mobile controls
    await page.evaluate(() => {
        const btn = document.querySelector(".mobile-abort-button") as HTMLElement;
        if (btn) btn.click();
    });
    
    await page.waitForSelector(".modal-window", { visible: true, timeout: 5000 });
    await page.evaluate(() => {
        const btn = document.querySelector(".modal-window .primary-button") as HTMLElement;
        if (btn) btn.click();
    });
    
    await page.waitForSelector("#screen-debrief", { visible: true });
    expect(page.url()).toContain("debrief");
  }, 120000);
});
