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
            mode: "Preset",
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
          "voidlock_session_state",
          JSON.stringify({ screenId: "barracks", isCampaign: true }),
        );
        window.location.hash = "#barracks";
        window.location.reload();
      }, pkg.version);

      await page.waitForNavigation({ waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 2000)); // Wait for render

      // Select the dead soldier in the roster list (it's the only one)
      await page.waitForSelector(".soldier-item.dead", { visible: true });
      await page.click(".soldier-item.dead");
      await new Promise((r) => setTimeout(r, 500));

      // Switch to Armory tab
      const buttons = await page.$$("button");
      for (const btn of buttons) {
        const text = await page.evaluate((el) => el.textContent, btn);
        if (text === "Armory") {
          await btn.click();
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));

      const hasWarning = await page.evaluate(() => {
        // We now expect Title Case
        const warningText = "Soldier is Deceased - Equipment Locked";
        return document.body.innerText.includes(warningText);
      });
      expect(hasWarning).toBe(true);

      const isSlotDisabled = await page.evaluate(() => {
        const slot = document.querySelector(".paper-doll-slot");
        return slot?.classList.contains("disabled");
      });
      expect(isSlotDisabled).toBe(true);

      const isArmoryDisabled = await page.evaluate(() => {
        // Armory items are menu-items but NOT soldier-items
        const items = Array.from(
          document.querySelectorAll(".menu-item.clickable"),
        ).filter((el) => !el.classList.contains("soldier-item"));
        return items[0]?.classList.contains("disabled");
      });
      expect(isArmoryDisabled).toBe(true);
    } catch (e) {
        console.error("Test failed with error:", e);
        throw e;
    }
  }, 30000);
});
