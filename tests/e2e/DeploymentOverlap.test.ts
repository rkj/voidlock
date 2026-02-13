import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-49x66: Deployment Overlap Bug", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1600, height: 1200 });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should NOT allow multiple units to be deployed on the same spawn point", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    
    // Ensure Manual Deployment is ON
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.evaluate(() => {
        const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        return el.checked;
    });
    if (!isChecked) {
        await page.evaluate(() => {
            const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
            el.click();
        });
    }

    // Select Dense Ship for predictable spawns
    await page.select("#map-generator-type", "DenseShip");

    // Go to equipment screen to add soldiers
    await page.click("#btn-goto-equipment");
    await page.waitForSelector(".equipment-screen");
    
    // Add 2 soldiers
    const emptySlots = await page.$$(".soldier-list-panel .menu-item");
    for (let i = 0; i < 2; i++) {
        await emptySlots[i].click();
        await page.waitForSelector(".armory-panel .soldier-card", { visible: true });
        const cards = await page.$$(".armory-panel .soldier-card");
        await cards[0].click();
        await new Promise(r => setTimeout(r, 100));
    }

    // Confirm Squad
    await page.click("button.primary-button");
    
    // Launch Mission
    await page.waitForSelector("#btn-launch-mission");
    await page.click("#btn-launch-mission");

    // Wait for Deployment Phase
    await page.waitForSelector(".deployment-summary");
    await page.waitForSelector("#game-canvas");

    // Get spawn point 0 coordinates
    const spawnPoint = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.currentGameState;
        const s = state.map.squadSpawns[0];
        // @ts-ignore
        const cellSize = app.context.renderer.cellSize;
        const canvas = document.getElementById("game-canvas");
        const rect = canvas?.getBoundingClientRect();
        return {
            x: s.x,
            y: s.y,
            pixelX: rect!.left + (s.x + 0.5) * cellSize,
            pixelY: rect!.top + (s.y + 0.5) * cellSize
        };
    });

    const units = await page.$$(".deployment-unit-item");
    
    // Drag first unit to spawn point
    const rect0 = await units[0].boundingBox();
    await page.mouse.move(rect0!.x + rect0!.width / 2, rect0!.y + rect0!.height / 2);
    await page.mouse.down();
    await page.mouse.move(spawnPoint.pixelX, spawnPoint.pixelY, { steps: 5 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 200));

    // Drag second unit to SAME spawn point
    const rect1 = await units[1].boundingBox();
    await page.mouse.move(rect1!.x + rect1!.width / 2, rect1!.y + rect1!.height / 2);
    await page.mouse.down();
    await page.mouse.move(spawnPoint.pixelX, spawnPoint.pixelY, { steps: 5 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 200));

    // Both should NOT be deployed at the same time if we want to fix this
    // Currently, it's expected that they CAN be (the bug)
    
    const deployedUnitsCount = await page.evaluate(() => {
        const items = document.querySelectorAll(".deployment-unit-item");
        return Array.from(items).filter(item => {
            const span = item.querySelector(".roster-item-details span:last-child") as HTMLElement;
            return span && span.textContent === "Deployed";
        }).length;
    });

    console.log("Deployed units count:", deployedUnitsCount);
    
    // If it's broken, both will be deployed
    // We expect it to NOT allow both to stay on the same tile
    // Actually, CommandHandler SWAPS them, so only ONE should be deployed at that spot, 
    // and the other should be moved to where the first one was.
    // BUT if the first one was pending, where does the second one go?
    
    // Let's check unit positions
    const unitPositions = await page.evaluate(() => {
         // @ts-ignore
         const state = window.GameAppInstance.currentGameState;
         return state.units.map((u: any) => ({ id: u.id, x: Math.floor(u.pos.x), y: Math.floor(u.pos.y), isDeployed: u.isDeployed }));
    });
    
    console.log("Unit positions:", JSON.stringify(unitPositions));
    
    // Check for overlaps
    const overlaps = unitPositions.filter((u1: any, i: number) => 
        u1.isDeployed !== false && 
        unitPositions.some((u2: any, j: number) => i !== j && u2.isDeployed !== false && u1.x === u2.x && u1.y === u2.y)
    );
    
    expect(overlaps.length).toBe(0);
  });
});
