// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";
import pkg from "../../package.json";

describe("Visual Verification - Dead Soldier Equipment", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    page.on("console", msg => console.log("BROWSER:", msg.text()));
    await page.setViewport({ width: 1280, height: 800 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show disabled equipment for dead soldiers", async () => {
    try {
      await page.goto(E2E_URL, { waitUntil: "networkidle2" });

      await page.evaluate((version) => {
        const campaignState = {
          version: version,
          saveVersion: 1,
          seed: 12345,
          status: "Active",
          rules: {
            mode: "Custom",
            difficulty: "Standard",
            deathRule: "Iron",
            allowTacticalPause: true,
            mapGeneratorType: "DenseShip",
            difficultyScaling: 1,
            resourceScarcity: 1,
            startingScrap: 1000,
            mapGrowthRate: 1,
            baseEnemyCount: 3,
            enemyGrowthPerMission: 1,
            economyMode: "Open",
            skipPrologue: true
          },
          scrap: 1000,
          intel: 100,
          currentSector: 1,
          currentNodeId: "node_0_1",
          nodes: [
            {
              id: "node_0_1",
              type: "Combat",
              status: "Accessible",
              difficulty: 1,
              rank: 0,
              mapSeed: 123,
              connections: [],
              position: { x: 0, y: 0 },
              bonusLootCount: 0,
            },
          ],
          roster: [
            {
              id: "dead-1",
              name: "Corpse McDead",
              archetypeId: "assault",
              hp: 0,
              maxHp: 100,
              soldierAim: 90,
              xp: 0,
              level: 1,
              kills: 0,
              missions: 1,
              status: "Dead",
              equipment: { rightHand: "pulse_rifle", leftHand: "combat_knife" },
              recoveryTime: 0
            },
          ],
          history: [],
          unlockedArchetypes: ["assault", "medic", "scout", "heavy"],
          unlockedItems: []
        };

        const campaignConfig = {
          mapWidth: 10,
          mapHeight: 10,
          spawnPointCount: 3,
          fogOfWarEnabled: true,
          debugOverlayEnabled: false,
          debugSnapshots: false,
          losOverlayEnabled: false,
          agentControlEnabled: true,
          allowTacticalPause: true,
          mapGeneratorType: "DenseShip",
          missionType: "Default",
          lastSeed: 12345,
          startingThreatLevel: 0,
          baseEnemyCount: 3,
          enemyGrowthPerMission: 1,
          bonusLootCount: 0,
          debugSnapshotInterval: 0,
          manualDeployment: true,
          campaignNodeId: "node_0_1",
          squadConfig: {
            soldiers: [
              {
                id: "dead-1",
                name: "Corpse McDead",
                archetypeId: "assault",
                rightHand: "pulse_rifle",
                leftHand: "combat_knife",
              },
            ],
            inventory: {},
          },
        };

        const globalConfig = {
          unitStyle: "TacticalIcons",
          themeId: "default",
          logLevel: "INFO",
          debugSnapshots: false,
          debugSnapshotInterval: 0,
          debugOverlayEnabled: false,
          cloudSyncEnabled: false
        };

        localStorage.clear();
        localStorage.setItem(
          "voidlock_campaign_v1",
          JSON.stringify(campaignState),
        );
        localStorage.setItem(
          "voidlock_campaign_config",
          JSON.stringify(campaignConfig),
        );
        localStorage.setItem(
          "voidlock_global_config",
          JSON.stringify(globalConfig),
        );
        localStorage.setItem(
          "voidlock_session_state",
          JSON.stringify({ screenId: "equipment", isCampaign: true }),
        );
        window.location.hash = "#equipment";
        window.location.reload();
      }, pkg.version);

      await page.waitForNavigation({ waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 2000)); // Wait for render

      // Select the dead soldier in the roster list (it's the only one)
      // Note: In Equipment screen, they are in the left panel
      await page.waitForSelector(".soldier-item.dead", { visible: true });
      await page.click(".soldier-item.dead");
      await new Promise((r) => setTimeout(r, 1000));

      const hasWarning = await page.evaluate(() => {
        // We now expect Title Case
        const warningText = "Soldier is Deceased - Equipment Locked";
        const bodyText = document.body.innerText;
        return bodyText.includes(warningText);
      });
      expect(hasWarning).toBe(true);

      const isSlotDisabled = await page.evaluate(() => {
        const slot = document.querySelector(".paper-doll-slot");
        return slot?.classList.contains("disabled");
      });
      expect(isSlotDisabled).toBe(true);

      const isArmoryDisabled = await page.evaluate(() => {
        const app = (window as any).GameAppInstance;
        const inspector = app.equipmentScreen.inspector;
        console.log("Inspector isCampaign:", inspector.isCampaign);
        console.log("Inspector soldier:", inspector.soldier);
        console.log("IsDead():", inspector.isDead());

        // Armory items are menu-items with armory-item class
        const items = Array.from(
          document.querySelectorAll(".menu-item.clickable.armory-item"),
        );
        console.log("Armory items found:", items.length);
        if (items.length > 0) {
            console.log("First armory item classes:", items[0].className);
            console.log("First armory item HTML:", items[0].outerHTML);
        }
        return items[0]?.classList.contains("disabled");
      });
      expect(isArmoryDisabled).toBe(true);
    } catch (e) {
        console.error("Test failed with error:", e);
        throw e;
    }
  }, 30000);
});
