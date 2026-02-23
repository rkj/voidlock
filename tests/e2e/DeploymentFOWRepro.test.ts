import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Deployment Fog of War Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should respect FOW during deployment", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Enable Manual Deployment
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.$eval("#toggle-manual-deployment", (el: any) => el.checked);
    if (!isChecked) {
      await page.click("#toggle-manual-deployment");
    }

    // Set map size to 12x12
    await page.focus("#map-width");
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type("#map-width", "12");

    await page.focus("#map-height");
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type("#map-height", "12");

    // Launch to Deployment Phase
    await page.click("#btn-launch-mission");
    
    await page.waitForSelector(".deployment-summary", { timeout: 10000 });

    // Take screenshot for manual verification
    await page.screenshot({ path: "deployment_fow_check.png" });
    console.log("Screenshot saved to deployment_fow_check.png");

    // Auto-fill spawns to enable Start Mission button
    await page.waitForSelector("#btn-autofill-deployment");
    await page.click("#btn-autofill-deployment");

    // Check GameState visibility
    const visibilityInfo = await page.evaluate(() => {
      const app = (window as any).GameAppInstance;
      if (!app || !app.registry || !app.registry.missionRunner) return null;
      const state = app.registry.missionRunner.getCurrentGameState();
      if (!state) return null;
      
      // Get floor cells from renderer's shared state since it's omitted in GameState message
      const floorCells = app.renderer.sharedState.cells.filter((c: any) => c.type === 'Floor');
      
      return {
        discoveredCount: state.discoveredCells.length,
        totalCells: state.map.width * state.map.height,
        floorCellsCount: floorCells.length,
        status: state.status,
        width: state.map.width,
        height: state.map.height,
        spawnPointsCount: (state.map.squadSpawns || []).length + (state.map.squadSpawn ? 1 : 0)
      };
    });

    expect(visibilityInfo).not.toBeNull();
    console.log("Visibility Info during Deployment:", visibilityInfo);

    expect(visibilityInfo!.status).toBe("Deployment");
    
    // FAILURE CONDITION: discoveredCount is equal to floorCellsCount (entire map visible)
    // We expect it to be MUCH less if FOW is respected.
    expect(visibilityInfo!.discoveredCount).toBeLessThan(visibilityInfo!.floorCellsCount);

    // Pixel Analysis: Verify that most of the canvas is black
    const pixelAnalysis = await page.evaluate(() => {
      const canvas = document.querySelector("#game-canvas") as HTMLCanvasElement;
      if (!canvas) return null;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      let blackPixels = 0;
      let totalPixels = width * height;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        
        // Unexplored fog is usually very dark or black
        if (r < 20 && g < 20 && b < 20) {
          blackPixels++;
        }
      }
      
      return { 
        blackPixels, 
        totalPixels, 
        ratio: blackPixels / totalPixels 
      };
    });

    console.log("Pixel Analysis during Deployment:", pixelAnalysis);
    expect(pixelAnalysis).not.toBeNull();
    // We expect at least 70% of the map to be black in a 12x12 map with one spawn room revealed
    expect(pixelAnalysis!.ratio).toBeGreaterThan(0.7);

    // Start Mission
    await page.click("#btn-start-mission");
    
    // Wait for a bit for exploration to happen
    await new Promise(r => setTimeout(r, 2000));

    // Check GameState visibility again
    const postStartVisibility = await page.evaluate(() => {
      const app = (window as any).GameAppInstance;
      if (!app || !app.registry || !app.registry.missionRunner) return null;
      const state = app.registry.missionRunner.getCurrentGameState();
      if (!state) return null;
      return {
        discoveredCount: state.discoveredCells.length,
        status: state.status,
      };
    });

    console.log("Post-start Visibility Info:", postStartVisibility);
    expect(postStartVisibility!.status).toBe("Playing");
    // It should have discovered MORE cells by now
    expect(postStartVisibility!.discoveredCount).toBeGreaterThan(visibilityInfo!.discoveredCount);
  }, 60000);
});
