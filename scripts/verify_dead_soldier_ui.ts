import puppeteer from "puppeteer";
import * as fs from "fs";

async function verify() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Navigating to app...");
  await page.goto("http://192.168.20.8:5173/", { waitUntil: "networkidle2" });

  console.log("Injecting dead soldier state...");
  await page.evaluate(() => {
    const campaignState = {
      version: "1.0",
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
        },
      ],
      history: [],
      unlockedArchetypes: ["assault", "medic", "scout", "heavy"],
    };

    const campaignConfig = {
      mapWidth: 10,
      mapHeight: 10,
      spawnPointCount: 3,
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

    localStorage.setItem("voidlock_campaign_state", JSON.stringify(campaignState));
    localStorage.setItem("voidlock_campaign_config", JSON.stringify(campaignConfig));
    window.location.hash = "#equipment";
    window.location.reload();
  });

  console.log("Waiting for Equipment Screen to load...");
  await page.waitForNavigation({ waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1000)); // Wait for render

  console.log("Capturing screenshot...");
  await page.screenshot({ path: "dead_soldier_equipment_verification.png" });

  // Verification of visual elements
  const hasWarning = await page.evaluate(() => {
    return document.body.innerText.includes("SOLDIER IS DECEASED - EQUIPMENT LOCKED");
  });
  console.log("Has Deceased Warning:", hasWarning);

  const isSlotDisabled = await page.evaluate(() => {
    const slot = document.querySelector(".paper-doll-slot");
    return slot?.classList.contains("disabled");
  });
  console.log("Is Paper Doll Slot disabled:", isSlotDisabled);

  const isArmoryDisabled = await page.evaluate(() => {
    const armoryItem = document.querySelector(".armory-panel .menu-item");
    return armoryItem?.classList.contains("disabled");
  });
  console.log("Is Armory Item disabled:", isArmoryDisabled);

  await browser.close();
}

verify();
