import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression Guard: Mission Reload (voidlock-y70cc)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should restore mission after page reload", async () => {
    console.log("Navigating to", E2E_URL);
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // 1. Start a custom mission
    console.log("Starting custom mission...");
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Ensure manual deployment is enabled (so we see the deployment phase)
    await page.waitForSelector("#toggle-manual-deployment");
    const isManual = await page.$eval("#toggle-manual-deployment", (el: any) => el.checked);
    if (!isManual) {
      await page.click("#toggle-manual-deployment");
    }

    // Launch mission (into deployment phase)
    await page.waitForSelector("#btn-launch-mission");
    await page.click("#btn-launch-mission");

    // 2. Deployment phase: Auto-fill and start
    console.log("Auto-filling and starting mission...");
    await page.waitForSelector("#btn-autofill-deployment");
    await page.click("#btn-autofill-deployment");
    
    // Wait for Start Mission button to be enabled
    await new Promise(r => setTimeout(r, 500));
    await page.waitForSelector("#btn-start-mission:not([disabled])");
    await page.click("#btn-start-mission");

    // 3. Wait for mission tactical view
    console.log("Waiting for tactical view...");
    await page.waitForSelector("#game-canvas");
    // Wait for at least one state update to ensure something is drawn
    await new Promise(r => setTimeout(r, 2000));

    // 4. Pre-reload baseline
    console.log("Capturing pre-reload baseline...");
    await page.screenshot({ path: "pre_reload_mission.png" });

    // Verify canvas is not black before reload
    const isNotBlackPre = await page.evaluate(() => {
      const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
      if (!canvas) return false;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 0 || data[i+1] !== 0 || data[i+2] !== 0) {
          return true;
        }
      }
      return false;
    });
    expect(isNotBlackPre, "Canvas is black BEFORE reload").toBe(true);

    // 5. Execute reload
    console.log("Reloading page...");
    await page.reload({ waitUntil: "load" });

    // 6. Wait for mission to restore
    console.log("Waiting for mission restoration...");
    await page.waitForSelector("#game-canvas", { timeout: 10000 });
    
    // Give it a moment to re-initialize and render
    await new Promise(r => setTimeout(r, 3000));

    // 7. ASSERT: Canvas is visible and not black
    const canvasVisible = await page.$eval("#game-canvas", (el: any) => {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && el.offsetWidth > 0 && el.offsetHeight > 0;
    });
    expect(canvasVisible, "Canvas is not visible after reload").toBe(true);

    const isNotBlackPost = await page.evaluate(() => {
      const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
      if (!canvas) return false;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 0 || data[i+1] !== 0 || data[i+2] !== 0) {
          return true;
        }
      }
      return false;
    });
    expect(isNotBlackPost, "Canvas is black AFTER reload (regressed!)").toBe(true);

    // 8. ASSERT: HUD elements are visible and populated
    const hudVisible = await page.$eval("#screen-mission", (el: any) => {
      return window.getComputedStyle(el).display !== "none";
    });
    expect(hudVisible, "Mission HUD is not visible after reload").toBe(true);

    const soldiersRestored = await page.$eval("#soldier-list", (el: any) => {
      return el.children.length > 0;
    });
    expect(soldiersRestored, "No soldiers restored in HUD after reload").toBe(true);

    const speedControlVisible = await page.$eval("#speed-control", (el: any) => {
      return window.getComputedStyle(el).display !== "none";
    });
    expect(speedControlVisible, "Speed control not visible after reload").toBe(true);

    // 9. Post-reload proof
    console.log("Capturing post-reload proof...");
    await page.screenshot({ path: "post_reload_mission.png" });
  }, 60000);
});
