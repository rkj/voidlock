// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Visual Verification - Dead Soldier Equipment", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show disabled equipment for dead soldiers", async () => {
    try {
      const campaignState = {
        version: "0.142.7",
        saveVersion: 1,
        seed: 12345,
        status: "Active",
        rules: {
          mode: "Custom",
          difficulty: "Standard",
          deathRule: "Clone",
          allowTacticalPause: true,
          mapGeneratorType: "DenseShip",
          difficultyScaling: 1.0,
          resourceScarcity: 1.0,
          startingScrap: 500,
          mapGrowthRate: 0.5,
          baseEnemyCount: 3,
          enemyGrowthPerMission: 1.0,
          economyMode: "Open",
          skipPrologue: false
        },
        scrap: 500,
        intel: 0,
        currentSector: 1,
        currentNodeId: "node-1",
        nodes: [
          {
            id: "node-1",
            type: "Combat",
            status: "Accessible",
            difficulty: 1,
            rank: 1,
            mapSeed: 12345,
            connections: [],
            position: { x: 0, y: 0 },
            missionType: "Default",
            bonusLootCount: 0
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
          {
            id: "alive-1",
            name: "Survivor",
            archetypeId: "assault",
            hp: 100,
            maxHp: 100,
            soldierAim: 90,
            xp: 0,
            level: 1,
            kills: 0,
            missions: 1,
            status: "Healthy",
            equipment: { rightHand: "pulse_rifle", leftHand: "combat_knife" },
            recoveryTime: 0
          }
        ],
        history: [],
        unlockedArchetypes: ["assault", "medic", "scout"],
        unlockedItems: [],
      };

      const campaignConfig = {
        mapWidth: 10,
        mapHeight: 10,
        spawnPointCount: 1,
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
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
        manualDeployment: false,
        campaignNodeId: "node-1",
        squadConfig: {
          soldiers: [
            {
              id: "dead-1",
              name: "Corpse McDead",
              archetypeId: "assault",
              status: "Dead",
              rightHand: "pulse_rifle",
              leftHand: "combat_knife",
            },
            {
              id: "alive-1",
              name: "Survivor",
              archetypeId: "assault",
              status: "Healthy",
              rightHand: "pulse_rifle",
              leftHand: "combat_knife",
            }
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

      const sessionState = { screenId: "equipment", isCampaign: true };

      // Inject state BEFORE navigation
      await page.evaluateOnNewDocument((s, c, sess, g) => {
          localStorage.clear();
          localStorage.setItem("voidlock_campaign_v1", s);
          localStorage.setItem("voidlock_campaign_config", c);
          localStorage.setItem("voidlock_session_state", sess);
          localStorage.setItem("voidlock_global_config", g);
      }, JSON.stringify(campaignState), JSON.stringify(campaignConfig), JSON.stringify(sessionState), JSON.stringify(globalConfig));

      // Now navigate
      await page.goto(`${E2E_URL}/#equipment`);
      
      await page.waitForSelector("#screen-equipment", { visible: true, timeout: 15000 });

      // Log for proof
      const soldierItemsInfo = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll(".soldier-item"));
          return items.map(item => ({
              classes: Array.from(item.classList),
              text: (item as HTMLElement).innerText.substring(0, 50)
          }));
      });
      console.log("Soldier Items found:", JSON.stringify(soldierItemsInfo, null, 2));

      // Select the dead soldier
      await page.waitForSelector(".soldier-item.dead", { visible: true, timeout: 15000 });
      
      await page.click(".soldier-item.dead");

      // Verify warning
      await page.waitForSelector(".dead-warning", { visible: true });

      // Verify armory disabled
      const isArmoryDisabled = await page.evaluate(() => {
        const items = document.querySelectorAll(".menu-item.armory-item");
        return items.length > 0 && items[0].classList.contains("disabled");
      });
      expect(isArmoryDisabled).toBe(true);
    } catch (e) {
        console.error("Test failed with error:", e);
        throw e;
    }
  }, 40000);
});
