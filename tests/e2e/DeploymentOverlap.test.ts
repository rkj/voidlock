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

  it("should ALLOW multiple units to be deployed on the same spawn point", async () => {
    await page.goto(E2E_URL, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    
    // Wait for App to be ready
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    await page.waitForSelector("#btn-menu-custom");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-custom");
        if (btn) btn.click();
    });
    
    // Ensure Manual Deployment is ON
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.evaluate(() => {
        const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        return el.checked;
    });
    if (!isChecked) {
        await page.evaluate(() => {
            const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
            if (el) el.click();
        });
    }

    // Select Dense Ship for predictable spawns
    await page.select("#map-generator-type", "DenseShip");
    
    // Set spawn points to 1 to force overlap
    await page.evaluate(() => {
        const slider = document.getElementById("map-spawn-points") as HTMLInputElement;
        if (slider) {
            slider.value = "1";
            slider.dispatchEvent(new Event("input", { bubbles: true }));
            slider.dispatchEvent(new Event("change", { bubbles: true }));
        }
    });

    // Go to equipment screen to add soldiers
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (btn) btn.click();
    });
    await page.waitForSelector(".equipment-screen", { visible: true });
    
    // Confirm Squad (already has 4 soldiers by default)
    await page.waitForSelector("#screen-equipment [data-focus-id='btn-back']", { visible: true });
    await page.evaluate(() => {
        const btn = document.querySelector("#screen-equipment [data-focus-id='btn-back']") as HTMLElement;
        if (btn) btn.click();
    });
    
    // Launch Mission
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission");
        if (btn) btn.click();
    });

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
        return state.map.squadSpawns[0];
    });

    if (!spawnPoint) throw new Error("Could not find spawn point or renderer not ready");

    // Manually deploy 2 units to the same spawn point via Command
    await page.evaluate((sp) => {
        // @ts-ignore
        const app = (window as any).GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        
        // Deploy first 2 units
        for (let i = 0; i < 2; i++) {
            app.gameClient.applyCommand({
                type: "DEPLOY_UNIT",
                unitId: state.units[i].id,
                target: { x: sp.x + 0.5, y: sp.y + 0.5 }
            });
        }
    }, spawnPoint);

    await new Promise(r => setTimeout(r, 1000));

    // Check for overlaps in the game state
    const unitPositions = await page.evaluate(() => {
         // @ts-ignore
         const state = (window as any).GameAppInstance.registry.missionRunner.getCurrentGameState();
         return state.units.map((u: any) => ({ id: u.id, x: Math.floor(u.pos.x), y: Math.floor(u.pos.y), isDeployed: u.isDeployed }));
    });
    
    // Check for overlaps
    const overlaps = unitPositions.filter((u1: any, i: number) => 
        u1.isDeployed !== false && 
        unitPositions.some((u2: any, j: number) => i !== j && u2.isDeployed !== false && u1.x === u2.x && u1.y === u2.y)
    );
    
    // We now expect 2 units to overlap
    expect(overlaps.length).toBeGreaterThanOrEqual(2);
  });
});
