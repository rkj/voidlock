import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-49x66: Deployment Overlap Bug", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1600, height: 1200 });
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should NOT allow multiple units to be deployed on the same spawn point", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    
    // Ensure Manual Deployment is ON
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.evaluate(() => {
        const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        return el.checked;
    });
    if (!isChecked) {
        await page.click("#toggle-manual-deployment");
    }

    // Select Dense Ship for predictable spawns
    await page.select("#map-generator-type", "DenseShip");

    // Go to equipment screen to add soldiers
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.click("#btn-goto-equipment");
    await page.waitForSelector(".equipment-screen", { visible: true });
    
    // Add 2 more soldiers by clicking empty slots (2, 3)
    // Default squad already has 2 soldiers in slots 0, 1
    for (let i = 2; i < 4; i++) {
        const slotSelector = `.soldier-list-panel div[data-focus-id="soldier-slot-${i}"]`;
        await page.waitForSelector(slotSelector);
        await page.click(slotSelector);
        
        await page.waitForSelector(".armory-panel .soldier-card", { visible: true });
        await page.click(".armory-panel .soldier-card");
        await new Promise(r => setTimeout(r, 500)); // Wait for re-render
    }

    // Confirm Squad
    await page.waitForSelector("[data-focus-id='btn-confirm-squad']", { visible: true });
    await page.click("[data-focus-id='btn-confirm-squad']");
    
    // Launch Mission
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");

    // Wait for Deployment Phase
    await page.waitForSelector(".deployment-summary", { visible: true });
    await page.waitForSelector("#game-canvas", { visible: true });

    // Wait for renderer to be ready
    await new Promise(r => setTimeout(r, 2000));

    // Get spawn point 0 coordinates
    const spawnPoint = await page.evaluate(() => {
        // @ts-ignore
        const app = (window as any).GameAppInstance;
        if (!app || !app.renderer) return null;
        
        const state = app.registry.missionRunner.getCurrentGameState();
        const s = state.map.squadSpawns[0];
        // @ts-ignore
        const cellSize = app.renderer.cellSize;
        const canvas = document.getElementById("game-canvas");
        const rect = canvas?.getBoundingClientRect();
        return {
            x: s.x,
            y: s.y,
            pixelX: rect!.left + (s.x + 0.5) * cellSize,
            pixelY: rect!.top + (s.y + 0.5) * cellSize
        };
    });

    if (!spawnPoint) throw new Error("Could not find spawn point or renderer not ready");

    const units = await page.$$(".deployment-unit-item");
    expect(units.length).toBeGreaterThanOrEqual(2);
    
    // Drag first unit to spawn point
    const rect0 = await units[0].boundingBox();
    if (!rect0) throw new Error("Unit 0 bounding box not found");
    await page.mouse.move(rect0.x + rect0.width / 2, rect0.y + rect0.height / 2);
    await page.mouse.down();
    await page.mouse.move(spawnPoint.pixelX, spawnPoint.pixelY, { steps: 5 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 500));

    // Drag second unit to SAME spawn point
    const rect1 = await units[1].boundingBox();
    if (!rect1) throw new Error("Unit 1 bounding box not found");
    await page.mouse.move(rect1.x + rect1.width / 2, rect1.y + rect1.height / 2);
    await page.mouse.down();
    await page.mouse.move(spawnPoint.pixelX, spawnPoint.pixelY, { steps: 5 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 500));

    // Check for overlaps in the game state
    const unitPositions = await page.evaluate(() => {
         // @ts-ignore
         const state = (window as any).GameAppInstance.registry.missionRunner.getCurrentGameState();
         return state.units.map((u: any) => ({ id: u.id, x: Math.floor(u.pos.x), y: Math.floor(u.pos.y), isDeployed: u.isDeployed }));
    });
    
    console.log("Unit positions:", JSON.stringify(unitPositions));
    
    // Check for overlaps
    const overlaps = unitPositions.filter((u1: any, i: number) => 
        u1.isDeployed !== false && 
        unitPositions.some((u2: any, j: number) => i !== j && u2.isDeployed !== false && u1.x === u2.x && u1.y === u2.y)
    );
    
    // We expect 0 overlaps if the fix is working
    expect(overlaps.length).toBe(0);
  });
});
