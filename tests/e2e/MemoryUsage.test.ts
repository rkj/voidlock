import { describe, it, expect, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";
import type { Page } from "puppeteer";

describe("Memory Usage Regression", () => {
  let page: Page;

  afterAll(async () => {
    await closeBrowser();
  });

  it("should not leak significant memory over multiple mission cycles", async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);

    // Helper to get heap size after GC
    const getHeapSize = async () => {
      await page.evaluate(() => {
        if (typeof window.gc === 'function') {
           window.gc();
        }
      });
      const metrics = await page.metrics();
      return metrics.JSHeapUsedSize;
    };

    // Helper to run a full mission cycle
    const runMissionCycle = async (iteration: number) => {
      // 1. Click Custom Mission
      await page.waitForSelector("#btn-menu-custom", { visible: true });
      await page.click("#btn-menu-custom");

      // 2. Launch Mission Setup -> Equipment
      await page.waitForSelector("#btn-goto-equipment", { visible: true });
      await page.click("#btn-goto-equipment");

      // 3. Confirm Squad -> Launch Mission
      await page.waitForSelector(".equipment-screen .primary-button", { visible: true });
      await page.click(".equipment-screen .primary-button");

      // 4. Wait for game to load
      await page.waitForSelector("#game-canvas", { visible: true });
      // Wait a bit for engine to start
      await new Promise(r => setTimeout(r, 1000));

      // 5. Toggle Debug Mode via keyboard (Backquote key `~`)
      await page.keyboard.press("Backquote");

      // 6. Force Win (Debug tool)
      await page.waitForSelector("#btn-force-win", { visible: true });
      await page.click("#btn-force-win");

      // 7. Wait for Debrief Screen and click Continue
      await page.waitForSelector(".debrief-screen .debrief-button", { visible: true });
      await new Promise(r => setTimeout(r, 500)); // Allow UI to stabilize
      await page.click(".debrief-screen .debrief-button");

      // 8. Wait for Main Menu
      await page.waitForSelector("#btn-menu-custom", { visible: true });
      
      const heap = await getHeapSize();
      console.log(`Cycle ${iteration} complete. Heap: ${(heap / 1024 / 1024).toFixed(2)} MB`);
      return heap;
    };

    // Initial Baseline
    const initialHeap = await getHeapSize();
    console.log(`Baseline Heap: ${(initialHeap / 1024 / 1024).toFixed(2)} MB`);

    const samples: number[] = [];
    const numCycles = 10;
    for (let i = 1; i <= numCycles; i++) {
      samples.push(await runMissionCycle(i));
    }

    const finalHeap = samples[samples.length - 1];
    const growth = finalHeap - initialHeap;
    const growthMB = growth / 1024 / 1024;

    console.log(`Total growth after ${numCycles} cycles: ${growthMB.toFixed(2)} MB`);

    const midPoint = Math.floor(numCycles / 2);
    const midHeap = samples[midPoint - 1];
    const secondHalfGrowth = finalHeap - midHeap;
    const secondHalfGrowthMB = secondHalfGrowth / 1024 / 1024;

    console.log(`Growth in second half (${numCycles - midPoint} cycles): ${secondHalfGrowthMB.toFixed(2)} MB`);

    expect(secondHalfGrowthMB).toBeLessThan(10); // Slightly more lenient threshold for now
  }, 300000); // 5 minute timeout
});
