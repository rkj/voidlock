import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Campaign Sector Map Keyboard Navigation", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should only allow focus on accessible and current nodes", async () => {
    await page.goto(E2E_URL);
    
    // Mock Campaign State
    const mockState = {
      version: "0.138.4",
      saveVersion: 1,
      seed: 123,
      status: "Active",
      rules: {
        mode: "Custom",
        difficulty: "Clone",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        difficultyScaling: 1,
        resourceScarcity: 1,
        startingScrap: 500,
        mapGrowthRate: 1,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        economyMode: "Open"
      },
      scrap: 500,
      intel: 0,
      currentSector: 1,
      currentNodeId: "node-0",
      nodes: [
        {
          id: "node-0",
          type: "Combat",
          status: "Cleared",
          difficulty: 1,
          rank: 0,
          mapSeed: 123,
          connections: ["node-1", "node-2"],
          position: { x: 0, y: 0 }
        },
        {
          id: "node-1",
          type: "Combat",
          status: "Accessible",
          difficulty: 1,
          rank: 1,
          mapSeed: 124,
          connections: ["node-3"],
          position: { x: 100, y: -50 }
        },
        {
          id: "node-2",
          type: "Combat",
          status: "Accessible",
          difficulty: 1,
          rank: 1,
          mapSeed: 125,
          connections: ["node-3"],
          position: { x: 100, y: 50 }
        },
        {
          id: "node-3",
          type: "Combat",
          status: "Revealed",
          difficulty: 1,
          rank: 2,
          mapSeed: 126,
          connections: [],
          position: { x: 200, y: 0 }
        }
      ],
      roster: [],
      history: [],
      unlockedArchetypes: ["assault", "medic", "scout"],
      unlockedItems: []
    };

    await page.evaluate((state) => {
      localStorage.setItem("voidlock_campaign_v1", JSON.stringify(state));
      localStorage.setItem("voidlock_global_config", JSON.stringify({
        unitStyle: "TacticalIcons",
        themeId: "default",
        logLevel: "INFO",
        debugSnapshots: false,
        debugSnapshotInterval: 0,
        debugOverlayEnabled: false,
        cloudSyncEnabled: false
      }));
    }, mockState);

    await page.goto(E2E_URL + "#campaign");
    await page.waitForSelector(".campaign-node");

    // 1. Verify tabIndices
    const tabIndices = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".campaign-node"));
      return nodes.map(n => ({
        id: (n as HTMLElement).dataset.id,
        status: (n as HTMLElement).classList.contains("cleared") ? "Cleared" : 
                (n as HTMLElement).classList.contains("accessible") ? "Accessible" : "Revealed",
        tabIndex: (n as HTMLElement).tabIndex,
        isCurrent: (n as HTMLElement).classList.contains("current")
      }));
    });

    for (const node of tabIndices) {
      if (node.status === "Accessible" || node.isCurrent) {
        expect(node.tabIndex, `Node ${node.id} should be focusable`).toBe(0);
      } else {
        expect(node.tabIndex, `Node ${node.id} should NOT be focusable`).toBe(-1);
      }
    }

    // 2. Verify Arrow navigation ignores revealed node
    // Focus node-0 (current)
    await page.focus('.campaign-node[data-id="node-0"]');
    
    // Press ArrowRight - should go to node-1 or node-2
    await page.keyboard.press("ArrowRight");
    let activeId = await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.id);
    expect(["node-1", "node-2"]).toContain(activeId);

    // Press ArrowRight again - it should NOT go to node-3 (Revealed)
    await page.keyboard.press("ArrowRight");
    activeId = await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.id);
    expect(activeId).not.toBe("node-3");

    // Try Tab navigation
    await page.focus('.campaign-node[data-id="node-0"]');
    await page.keyboard.press("Tab");
    activeId = await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.id);
    expect(["node-1", "node-2"]).toContain(activeId);

    await page.keyboard.press("Tab");
    activeId = await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.id);
    // Might be other node or abandon button
    if (activeId === "node-1" || activeId === "node-2") {
        // Ok
    } else {
        const activeTag = await page.evaluate(() => document.activeElement?.tagName);
        expect(activeTag).toBe("BUTTON"); // Abandon button
    }
    
    await page.screenshot({ path: "tests/e2e/__snapshots__/campaign_navigation.png" });
  });
});
