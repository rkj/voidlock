import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Spawn Point Overlap Reproduction", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
    page.on("console", msg => console.log("PAGE LOG:", msg.text()));
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should demonstrate that Start Mission is disabled when 4 units are on 2 spawn points", async () => {
    console.log("Navigating to", E2E_URL);
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    await new Promise(r => setTimeout(r, 2000));
    
    // Wait for the main menu to be ready
    console.log("Waiting for #btn-menu-custom...");
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    
    // Go to Custom Mission
    console.log("Clicking Custom Mission button...");
    await page.click("#btn-menu-custom");

    // Wait for the mission setup screen
    console.log("Waiting for #screen-mission-setup...");
    await page.waitForSelector("#screen-mission-setup", { visible: true });

    // Set map configuration directly with 4 squad spawns initially
    console.log("Setting map configuration with 4 squad spawns...");
    await page.evaluate(() => {
      // @ts-ignore
      const app = (window as any).GameAppInstance;
      const msm = app.registry.missionSetupManager;
      msm.currentStaticMapData = {
        width: 10,
        height: 10,
        cells: Array.from({length: 100}, (_, i) => ({ x: i % 10, y: Math.floor(i / 10), type: "Floor", roomId: "room-1" })),
        walls: [],
        doors: [],
        spawnPoints: [],
        squadSpawns: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
        extraction: { x: 9, y: 9 },
        objectives: [{ id: "obj1", kind: "Recover", targetCell: { x: 5, y: 5 } }]
      };
      msm.currentMapGeneratorType = "Static";
      msm.currentMissionType = "Default";
      msm.manualDeployment = true;
      msm.saveCurrentConfig();
    });

    // Enable Manual Deployment in UI
    console.log("Enabling Manual Deployment...");
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.$eval("#toggle-manual-deployment", (el: any) => el.checked);
    if (!isChecked) {
      await page.click("#toggle-manual-deployment");
    }

    // Go to Equipment to ensure we have 4 soldiers
    console.log("Navigating to Equipment...");
    await page.click("#btn-goto-equipment");
    await page.waitForSelector(".equipment-screen", { visible: true });

    // Roster should have 2 soldiers by default, add 2 more
    for (let i = 2; i < 4; i++) {
        const slotSelector = `.soldier-list-panel div[data-focus-id="soldier-slot-${i}"]`;
        await page.waitForSelector(slotSelector);
        await page.click(slotSelector);
        
        await page.waitForSelector(".armory-panel .soldier-card", { visible: true });
        await page.click(".armory-panel .soldier-card");
        await new Promise(r => setTimeout(r, 500)); 
    }

    // Confirm Squad
    await page.click("[data-focus-id='btn-confirm-squad']");

    // Launch Mission
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");

    // Wait for Deployment Phase
    await page.waitForSelector(".deployment-summary", { visible: true });
    
    // Wait for renderer/engine to be ready
    await new Promise(r => setTimeout(r, 2000));

    // NOW: Monkey-patch HUDManager to only recognize 2 spawns for validation
    console.log("Monkey-patching HUDManager to only recognize 2 spawns...");
    await page.evaluate(() => {
        // @ts-ignore
        const app = (window as any).GameAppInstance;
        const hud = app.registry.hudManager;
        const originalUpdate = hud.update;
        hud.update = function(state: any, selectedId: any) {
            if (state && state.map) {
                state.map.squadSpawns = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
            }
            return originalUpdate.call(this, state, selectedId);
        };
        
        // Also force a re-render now
        const state = app.registry.missionRunner.getCurrentGameState();
        if (state) app.registry.missionRunner.updateUI(state);
    });

    // 1. Manually deploy Unit 1 to Spawn A (0,0)
    console.log("Deploying Unit 1 to Spawn A...");
    await page.evaluate(() => {
        // @ts-ignore
        const app = (window as any).GameAppInstance;
        const gc = app.registry.gameClient;
        const state = app.registry.missionRunner.getCurrentGameState();
        gc.applyCommand({
            type: "DEPLOY_UNIT",
            unitId: state.units[0].id,
            target: { x: 0.5, y: 0.5 }
        });
    });
    await new Promise(r => setTimeout(r, 1000));

    // 2. Click Auto-Fill
    console.log("Clicking Auto-Fill...");
    await page.click("#btn-autofill-deployment");
    await new Promise(r => setTimeout(r, 2000));

    // Log final state (from the HUD's perspective if we can)
    const finalStateInfo = await page.evaluate(() => {
      // @ts-ignore
      const app = (window as any).GameAppInstance;
      const state = app.registry.missionRunner.getCurrentGameState();
      // Apply the same transformation as our monkey-patch for logging
      state.map.squadSpawns = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
      
      return {
        units: state.units.map((u: any) => ({ id: u.id, x: Math.floor(u.pos.x), y: Math.floor(u.pos.y), isDeployed: u.isDeployed })),
        squadSpawns: state.map.squadSpawns
      };
    });
    console.log("Final Unit States (Forced):", JSON.stringify(finalStateInfo));

    const startBtnInfo = await page.$eval("#btn-start-mission", (el: any) => ({
      disabled: el.disabled,
      title: el.title
    }));
    console.log("Start Mission button info:", startBtnInfo);

    // THE REPRODUCTION GOAL:
    // Demonstrate that Start Mission is disabled because Unit 1 was kicked to an invalid tile.
    
    expect(startBtnInfo.disabled).toBe(true);
    expect(startBtnInfo.title).toBe("All squad members must be on valid spawn tiles.");

    // Take screenshot for proof
    await page.screenshot({ path: "spawn_point_overlap_repro.png" });


  }, 120000);
});
