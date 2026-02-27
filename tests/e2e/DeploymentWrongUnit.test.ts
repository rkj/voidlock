import { expect, test, describe, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Deployment Wrong Unit Selection", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await browser.close();
  });

  test("Dragging a unit from a stacked cell should move the top-most unit", async () => {
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });

    // 1. Start a custom mission (Simulation)
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Setup map with 1 spawn point to force stacking
    await page.waitForSelector("#map-width");
    
    // Debug: take screenshot of Mission Setup
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: "debug_mission_setup.png" });

    // Enable Manual Deployment
    const manualDeploymentCheckbox = await page.$("#toggle-manual-deployment");
    if (manualDeploymentCheckbox) {
        const isChecked = await page.evaluate(el => (el as HTMLInputElement).checked, manualDeploymentCheckbox);
        if (!isChecked) {
            await manualDeploymentCheckbox.click();
        }
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

    // 3. Squad Builder: Add 4 units
    await page.waitForSelector("#squad-builder");
    
    // Let's inspect the roster list content
    const rosterContent = await page.evaluate(() => {
        const rosterList = document.querySelector(".roster-list");
        return rosterList ? rosterList.innerHTML : "NOT FOUND";
    });
    console.log("Roster Content:", rosterContent);

    // If it's empty, maybe we need to wait more or it's not loaded?
    // In Custom Mission, it should have some archetypes.
    
    // Quick add 4 soldiers (double click in roster)
    for (let i = 0; i < 4; i++) {
        const rosterCards = await page.$$(".roster-list .soldier-item"); // Using .soldier-item
        if (rosterCards.length > i) {
            await rosterCards[i].click({ clickCount: 2 });
            await new Promise(r => setTimeout(r, 200)); 
        } else {
            console.log(`Roster card ${i} not found. Total found: ${rosterCards.length}`);
        }
    }

    // 4. Launch Mission (to enter deployment phase)
    await page.waitForSelector("#btn-launch-mission");
    await page.click("#btn-launch-mission");

    // 5. Deployment Phase: All 4 should be in the same spawn point cell (because we set spawnCount=1)
    await page.waitForSelector("#game-canvas");
    await new Promise(r => setTimeout(r, 2000)); 

    // Auto-fill in deployment phase to ensure they are on the spawn.
    await page.waitForSelector("#btn-autofill-deployment");
    await page.click("#btn-autofill-deployment");
    await new Promise(r => setTimeout(r, 1000));

    // Get the spawn point coordinate from state
    const spawnPoint = await page.evaluate(() => {
        // @ts-ignore
        const state = window.GameAppInstance.registry.gameClient.lastState;
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
        const sharedState = window.GameAppInstance.renderer.sharedState;
        const cellSize = sharedState.cellSize;
        const transform = sharedState.transform;
        
        return {
            x: (sp.x + 0.5) * cellSize * transform.scale + transform.x,
            y: (sp.y + 0.5) * cellSize * transform.scale + transform.y
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
        const state = window.GameAppInstance.registry.gameClient.lastState;
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
        const state = window.GameAppInstance.registry.gameClient.lastState;
        return state.units.filter(u => u.isDeployed !== false).map(u => u.id);
    });

    console.log("Final Deployed IDs:", finalDeployedIds);

    // EXPECTATION: The LAST unit (top-most) should have been the one dragged and undeployed.
    // If BUG: The FIRST unit (index 0) was undeployed instead.
    
    expect(finalDeployedIds, "The top-most unit should have been moved").not.toContain(lastUnitId);
    expect(finalDeployedIds, "The bottom-most unit should have remained").toContain(firstUnitId);
  }, 60000);
});
