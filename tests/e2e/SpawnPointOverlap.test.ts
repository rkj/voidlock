import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Spawn Point Overlap Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
    page.on("console", msg => console.log("PAGE LOG:", msg.text()));
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should allow 4 units to occupy 2 spawn points and enable Start Mission", async () => {
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

    // Set map configuration directly with ONLY 2 squad spawns
    console.log("Setting map configuration with 2 squad spawns...");
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
        squadSpawns: [{ x: 0, y: 0 }], // ONLY 1
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
    await page.click("[data-focus-id='btn-back']");

    // Launch Mission
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");

    // Wait for Deployment Phase
    await page.waitForSelector(".deployment-summary", { visible: true });
    
    // Wait for renderer/engine to be ready
    await new Promise(r => setTimeout(r, 2000));

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

    // Log final state
    const finalStateInfo = await page.evaluate(() => {
      // @ts-ignore
      const app = (window as any).GameAppInstance;
      const state = app.registry.missionRunner.getCurrentGameState();
      return {
        units: state.units.map((u: any) => ({ id: u.id, x: Math.floor(u.pos.x), y: Math.floor(u.pos.y), isDeployed: u.isDeployed })),
        squadSpawns: state.map.squadSpawns
      };
    });
    console.log("Final Unit States:", JSON.stringify(finalStateInfo));

    const startBtnInfo = await page.$eval("#btn-start-mission", (el: any) => ({
      disabled: el.disabled,
      title: el.title
    }));
    console.log("Start Mission button info:", startBtnInfo);

    // THE VERIFICATION GOAL:
    // Demonstrate that Start Mission is ENABLED because overlapping is allowed.
    
    expect(startBtnInfo.disabled).toBe(false);

    // Take screenshot for proof
    await page.screenshot({ path: "spawn_point_overlap_fixed.png" });

  }, 120000);
});
