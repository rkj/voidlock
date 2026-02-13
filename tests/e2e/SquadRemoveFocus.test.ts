import { expect, test, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";

test("Soldier 'X' button should be skipped by keyboard navigation", async () => {
  const page = await getNewPage();

  await page.goto(E2E_URL);
  const mockState = {
    rules: {
      difficulty: "Simulation",
      deathRule: "Clone",
      allowTacticalPause: true,
    },
    scrap: 500,
    intel: 50,
    roster: [
      {
        id: "soldier-1",
        name: "Sgt. Test",
        archetypeId: "assault",
        hp: 100,
        maxHp: 100,
        soldierAim: 70,
        xp: 0,
        level: 1,
        status: "Healthy",
        equipment: {
          rightHand: "pulse_rifle",
          leftHand: "combat_knife",
          body: "flak_armor",
          feet: "combat_boots",
        },
      },
    ],
    sectorMap: {
        nodes: [
            { id: "node-1", type: "Combat", x: 0, y: 0, depth: 0, connections: [], completed: false }
        ],
        currentNodeId: "node-1"
    },
    missionHistory: [],
    unlockedArchetypes: ["assault"],
    unlockedItems: ["pulse_rifle", "combat_knife", "flak_armor", "combat_boots"],
  };

  await page.evaluate((state) => {
    localStorage.setItem("voidlock_campaign_v1", JSON.stringify(state));
    localStorage.setItem(
      "voidlock_global_config",
      JSON.stringify({
        unitStyle: "TacticalIcons",
        themeId: "default",
        logLevel: "INFO",
        debugSnapshots: false,
        debugSnapshotInterval: 0,
        debugOverlayEnabled: false,
        cloudSyncEnabled: false,
      }),
    );
  }, mockState);

  await page.goto(E2E_URL + "#mission-setup");
  await page.screenshot({ path: "tests/e2e/__snapshots__/debug_squad_setup_1.png" });
  console.log("Waiting for .squad-builder-container...");
  await page.waitForSelector(".squad-builder-container", { timeout: 10000 });
  console.log(".squad-builder-container found.");

  // Add soldier to squad
  console.log("Clicking soldier card...");
  await page.click(".roster-list .soldier-card");
  await page.waitForSelector(".deployment-slot.occupied", { timeout: 10000 });
  console.log("Soldier added to squad.");
  await page.screenshot({ path: "tests/e2e/__snapshots__/debug_squad_setup_2.png" });

  // Focus the first soldier card in deployment slots
  await page.focus(".deployment-panel .deployment-slot.occupied .soldier-card");

  // Press ArrowRight to see if it focuses the 'X' button
  await page.keyboard.press("ArrowRight");

  // Get the active element class
  const activeClass = await page.evaluate(() => document.activeElement?.className);
  
  // It should NOT be slot-remove
  expect(activeClass).not.toContain("slot-remove");

  // Let's also check if it's focusable via Tab
  await page.focus(".deployment-panel .deployment-slot.occupied .soldier-card");
  await page.keyboard.press("Tab");
  const activeClassTab = await page.evaluate(() => document.activeElement?.className);
  expect(activeClassTab).not.toContain("slot-remove");
}, 30000);

afterAll(async () => {
  await closeBrowser();
});
