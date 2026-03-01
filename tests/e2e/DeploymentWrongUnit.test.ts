import { expect, test, describe, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Deployment Wrong Unit Selection", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  test("Dragging a unit from a stacked cell should move the top-most unit", async () => {
    await page.goto(E2E_URL, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    
    // Wait for App to be ready
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // 1. Start a custom mission (Simulation)
    await page.waitForSelector("#btn-menu-custom");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-custom");
        if (btn) btn.click();
    });

    // 2. Setup map with 1 spawn point to force stacking
    await page.waitForSelector("#map-width");
    
    // Enable Manual Deployment
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.$eval("#toggle-manual-deployment", (el: any) => el.checked);
    if (!isChecked) {
        await page.evaluate(() => {
            const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
            if (el) el.click();
        });
    }

    // Set map size small and spawn count to 1
    await page.evaluate(() => {
        const width = document.getElementById("map-width") as HTMLInputElement;
        const height = document.getElementById("map-height") as HTMLInputElement;
        const spawns = document.getElementById("map-spawn-points") as HTMLInputElement;
        const generator = document.getElementById("map-generator-type") as HTMLSelectElement;
        if (width) width.value = "10";
        if (height) height.value = "10";
        if (generator) {
            generator.value = "DenseShip";
            generator.dispatchEvent(new Event("change"));
        }
        if (spawns) {
            spawns.value = "1";
            spawns.dispatchEvent(new Event("input"));
            spawns.dispatchEvent(new Event("change"));
        }
    });

    // 3. Squad Builder: 4 units are added by default
    await page.waitForSelector("#squad-builder");
    
    // 4. Launch Mission (to enter deployment phase)
    await page.waitForSelector("#btn-launch-mission");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission");
        if (btn) btn.click();
    });

    // 5. Deployment Phase: All 4 should be in the same spawn point cell (because we set spawnCount=1)
    await page.waitForSelector("#game-canvas");
    
    // Wait for App and Renderer to be fully ready
    await page.waitForFunction(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        return app && app.renderer !== null;
    });
    
    await new Promise(r => setTimeout(r, 2000)); 

    // Auto-fill in deployment phase to ensure they are on the spawn.
    await page.waitForSelector("#btn-autofill-deployment");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-autofill-deployment");
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Get the spawn point coordinate from state
    const spawnPoint = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        return state.map.squadSpawns?.[0] || state.map.squadSpawn;
    });

    if (!spawnPoint) {
        throw new Error("No spawn point found in state");
    }

    console.log("Spawn point:", spawnPoint);

    const canvasRect = await page.evaluate(() => {
        const canvas = document.getElementById("game-canvas");
        const rect = canvas!.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    });

    const pixelCoords = await page.evaluate((sp) => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const cellSize = app.renderer.cellSize;
        const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
        const rect = canvas?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        
        return {
            x: (sp.x + 0.5) * cellSize * scaleX,
            y: (sp.y + 0.5) * cellSize * scaleY
        };
    }, spawnPoint);

    const startX = canvasRect.left + pixelCoords.x;
    const startY = canvasRect.top + pixelCoords.y;

    // Target a cell to the right (undeploy)
    const targetX = startX + 200; 
    const targetY = startY;

    // Initial state check
    const initialDeployedIds = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        return state.units.filter(u => u.isDeployed !== false).map(u => u.id);
    });
    
    const firstUnitId = initialDeployedIds[0];
    const lastUnitId = initialDeployedIds[initialDeployedIds.length - 1];

    console.log("Initial Deployed IDs:", initialDeployedIds);
    console.log("First Unit ID (expected to stay):", firstUnitId);
    console.log("Last Unit ID (expected to move):", lastUnitId);

    // Perform drag
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.move(targetX, targetY, { steps: 20 });
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 1000));

    // Check which unit was undeployed
    const finalDeployedIds = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        return state.units.filter(u => u.isDeployed !== false).map(u => u.id);
    });

    console.log("Final Deployed IDs:", finalDeployedIds);

    // EXPECTATION: The LAST unit (top-most) should have been the one dragged and undeployed.
    // If BUG: The FIRST unit (index 0) was undeployed instead.
    
    expect(finalDeployedIds, "The top-most unit should have been moved").not.toContain(lastUnitId);
    expect(finalDeployedIds, "The bottom-most unit should have remained").toContain(firstUnitId);
  }, 60000);
});
