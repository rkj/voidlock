import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-49x66: Deployment Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  async function takeScreenshot(name: string) {
    await page.screenshot({ path: `tests/e2e/screenshots/${name}.png` });
    console.log(`Screenshot saved: tests/e2e/screenshots/${name}.png`);
  }

  it("should verify deployment fixes and features", async () => {
    // Ensure screenshots directory exists
    await page.evaluate(() => {
        // Just a dummy to ensure page is responsive
    });

    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");
    await takeScreenshot("1_main_menu");
    await page.click("#btn-menu-custom");
    
    // Ensure Manual Deployment is ON
    await page.waitForSelector("#toggle-manual-deployment");
    await takeScreenshot("2_mission_setup");
    await page.evaluate(() => {
        const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        if (!el.checked) el.click();
    });

    // Select Dense Ship for predictable spawns
    await page.select("#map-generator-type", "DenseShip");
    
    // Set map size to 12x12 for 4 spawns (1 + floor(6/2) = 4)
    await page.evaluate(() => {
        const wInput = document.getElementById("map-width") as HTMLInputElement;
        const hInput = document.getElementById("map-height") as HTMLInputElement;
        if (wInput) {
            wInput.value = "12";
            wInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (hInput) {
            hInput.value = "12";
            hInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        
        const slider = document.getElementById("map-spawn-points") as HTMLInputElement;
        if (slider) {
            slider.value = "6";
            slider.dispatchEvent(new Event("input", { bubbles: true }));
            slider.dispatchEvent(new Event("change", { bubbles: true }));
        }
    });

    // Add units to squad
    console.log("Going to equipment screen...");
    await page.click("#btn-goto-equipment");
    await page.waitForSelector("#screen-equipment", { visible: true });
    await takeScreenshot("3_equipment_screen");
    
    // Add 2 soldiers - re-fetching slots to avoid detached nodes
    for (let i = 2; i < 4; i++) {
        console.log(`Adding soldier ${i+1}...`);
        const slotSelector = `.soldier-list-panel div[data-focus-id="soldier-slot-${i}"]`;
        await page.waitForSelector(slotSelector);
        await page.click(slotSelector);
        
        await page.waitForSelector(".armory-panel .soldier-card", { visible: true });
        const cardSelector = ".armory-panel .soldier-card";
        await page.click(cardSelector);
        await new Promise(r => setTimeout(r, 500)); // Wait for render
    }
    await takeScreenshot("4_squad_confirmed");

    // Confirm Squad
    await page.click("button.primary-button");
    
    // Should be back at Mission Setup
    console.log("Back at mission setup, launching mission...");
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await takeScreenshot("5_back_at_setup");
    await page.click("#btn-launch-mission");

    // Wait for Deployment Phase
    console.log("Waiting for deployment phase...");
    await page.waitForSelector(".deployment-summary", { visible: true });
    await page.waitForSelector("#game-canvas");
    await takeScreenshot("6_deployment_phase");

    // Get spawn points and unit info
    const deploymentData = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        if (!app || !app.renderer) return null;
        const state = app.registry.missionRunner.getCurrentGameState();
        const spawns = state.map.squadSpawns || (state.map.squadSpawn ? [state.map.squadSpawn] : []);
        // @ts-ignore
        const cellSize = app.renderer.cellSize;
        const canvas = document.getElementById("game-canvas");
        const rect = canvas!.getBoundingClientRect();
        
        return {
            spawns: spawns.map(s => ({
                x: s.x,
                y: s.y,
                pixelX: rect.left + (s.x + 0.5) * cellSize,
                pixelY: rect.top + (s.y + 0.5) * cellSize
            })),
            units: state.units.map((u: any) => ({
                id: u.id,
                isDeployed: u.isDeployed,
                x: Math.floor(u.pos.x),
                y: Math.floor(u.pos.y)
            }))
        };
    });

    if (!deploymentData) throw new Error("Deployment Data could not be retrieved - app.renderer may be null");
    console.log("Deployment Data retrieved successfully:", JSON.stringify(deploymentData));

    // 1. Verify NO 'grab' cursor on pending unit's position
    const pendingUnit = deploymentData.units.find(u => u.isDeployed === false);
    if (pendingUnit) {
        const spawn = deploymentData.spawns.find(s => s.x === pendingUnit.x && s.y === pendingUnit.y);
        if (spawn) {
            console.log(`Hovering over spawn at (${spawn.x}, ${spawn.y}) where unit ${pendingUnit.id} is pending...`);
            // Ensure centered
            await page.evaluate((x, y) => {
                const container = document.getElementById("game-container");
                if (container) {
                    // @ts-ignore
                    const cellSize = window.GameAppInstance.renderer.cellSize;
                    container.scrollLeft = (x + 0.5) * cellSize - container.clientWidth / 2;
                    container.scrollTop = (y + 0.5) * cellSize - container.clientHeight / 2;
                }
            }, spawn.x, spawn.y);
            await new Promise(r => setTimeout(r, 200));

            // Re-calculate rect after scroll
            const rect = await page.evaluate(() => {
                const canvas = document.getElementById("game-canvas");
                if (!canvas) return { left: 0, top: 0 };
                const r = canvas.getBoundingClientRect();
                return { left: r.left, top: r.top };
            });
            const cellSize = await page.evaluate(() => (window as any).GameAppInstance.renderer?.cellSize || 128);
            const pixelX = Math.round(rect.left + (spawn.x + 0.5) * cellSize);
            const pixelY = Math.round(rect.top + (spawn.y + 0.5) * cellSize);

            console.log(`Computed Hover Coords: ${pixelX}, ${pixelY} (rect.left: ${rect.left}, rect.top: ${rect.top}, cellSize: ${cellSize})`);

            if (isNaN(pixelX) || isNaN(pixelY)) {
                throw new Error(`Computed coordinates are NaN: pixelX=${pixelX}, pixelY=${pixelY}`);
            }

            // Use move steps to trigger mousemove event correctly
            await page.mouse.move(pixelX, pixelY, { steps: 5 });
            await new Promise(r => setTimeout(r, 200));
            
            const cursor = await page.evaluate(() => document.getElementById("game-canvas")!.style.cursor);
            console.log("Cursor style (should be default):", cursor);
            expect(cursor).not.toBe("grab");
            expect(cursor === "" || cursor === "default").toBe(true);
        } else {
            console.log("Could not find spawn point for pending unit pos");
        }
    } else {
        console.log("No pending units found!");
    }

    // 2. Test Double-click to deploy
    console.log("Testing double-click to deploy...");
    const unitItems = await page.$$(".deployment-unit-item");
    const unit0Id = await unitItems[0].evaluate(el => el.dataset.unitId);
    console.log(`Double-clicking unit ${unit0Id}`);
    await unitItems[0].click({ clickCount: 2 });
    await new Promise(r => setTimeout(r, 500));

    const unit0Status = await unitItems[0].evaluate(el => el.querySelector(".roster-item-details span:last-child")?.textContent);
    console.log(`Unit 0 status: ${unit0Status}`);
    expect(unit0Status).toBe("Deployed");

    // 3. Verify 'grab' cursor NOW appears on the deployed unit
    const deployedUnitData = await page.evaluate((id) => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        const unit = state.units.find((u: any) => u.id === id);
        // @ts-ignore
        const cellSize = app.renderer.cellSize;
        const container = document.getElementById("game-container");
        if (container) {
            container.scrollLeft = unit.pos.x * cellSize - container.clientWidth / 2;
            container.scrollTop = unit.pos.y * cellSize - container.clientHeight / 2;
        }
        return { x: unit.pos.x, y: unit.pos.y };
    }, unit0Id);

    await new Promise(r => setTimeout(r, 200));
    
    const finalCoords = await page.evaluate((pos) => {
        const canvas = document.getElementById("game-canvas");
        if (!canvas) return { pixelX: 0, pixelY: 0 };
        const rect = canvas.getBoundingClientRect();
        // @ts-ignore
        const cellSize = window.GameAppInstance.renderer?.cellSize || 128;
        return {
            pixelX: Math.round(rect.left + pos.x * cellSize),
            pixelY: Math.round(rect.top + pos.y * cellSize)
        };
    }, deployedUnitData);

    console.log(`Hovering over deployed unit at (${finalCoords.pixelX}, ${finalCoords.pixelY})`);
    if (isNaN(finalCoords.pixelX) || isNaN(finalCoords.pixelY)) {
        throw new Error(`Final coordinates are NaN: pixelX=${finalCoords.pixelX}, pixelY=${finalCoords.pixelY}`);
    }
    await page.mouse.move(finalCoords.pixelX, finalCoords.pixelY, { steps: 5 });
    await new Promise(r => setTimeout(r, 200));
    const cursorAfterDeploy = await page.evaluate(() => document.getElementById("game-canvas")!.style.cursor);
    console.log("Cursor style after deploy (should be grab):", cursorAfterDeploy);
    expect(cursorAfterDeploy).toBe("grab");

    // 4. Test Auto-Fill
    console.log("Testing Auto-Fill...");
    await page.click("#btn-autofill-deployment");
    await new Promise(r => setTimeout(r, 500));

    const allDeployed = await page.evaluate(() => {
        const items = document.querySelectorAll(".deployment-unit-item");
        return Array.from(items).every(item => item.querySelector(".roster-item-details span:last-child")?.textContent === "Deployed");
    });
    expect(allDeployed).toBe(true);

    // 5. Verify Start Mission is enabled
    const isStartEnabled = await page.evaluate(() => {
        const btn = document.getElementById("btn-start-mission") as HTMLButtonElement;
        return !btn.disabled;
    });
    expect(isStartEnabled).toBe(true);

    await takeScreenshot("7_final_state");
  });
});
