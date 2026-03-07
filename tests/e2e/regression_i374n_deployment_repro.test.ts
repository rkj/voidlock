import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression i374n: Deployment Card Width & Map Canvas (Repro)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  const checkCardMetrics = async (selector: string, contextName: string) => {
    await page.waitForSelector(selector, { visible: true, timeout: 5000 });
    const metrics = await page.evaluate((sel) => {
        const cards = document.querySelectorAll(sel);
        return Array.from(cards).map(card => {
            const rect = card.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(card);
            const nameEl = card.querySelector('strong');
            const nameRect = nameEl ? nameEl.getBoundingClientRect() : { width: 0 };
            
            return {
                width: rect.width,
                overflow: computedStyle.overflow,
                nameWidth: nameRect.width,
                className: card.className,
                parentElementWidth: card.parentElement?.getBoundingClientRect().width,
                tagName: card.tagName
            };
        });
    }, selector);

    console.log(`${contextName} Metrics:`, JSON.stringify(metrics, null, 2));

    expect(metrics.length, `No cards found for ${contextName}`).toBeGreaterThan(0);
    
    for (const metric of metrics) {
        // ASSERT: Every soldier card has width >= 200px (Requirement 5)
        expect(metric.width, `Card (${metric.tagName}) in ${contextName} should be at least 200px wide. Got ${metric.width}px. Parent width: ${metric.parentElementWidth}`).toBeGreaterThanOrEqual(200);
        
        // ASSERT: Every soldier card has visible overflow (Requirement 6)
        // Note: .soldier-item currently has overflow: hidden in main.css
        expect(metric.overflow, `Card in ${contextName} should have visible overflow`).toBe('visible');
        
        // ASSERT: Soldier name text is visible and not truncated to zero width (Requirement 7)
        expect(metric.nameWidth, `Soldier name in ${contextName} should have a non-zero width`).toBeGreaterThan(0);
    }
  };

  const checkCanvasVisibility = async () => {
    const canvasMetrics = await page.evaluate(() => {
        const canvas = document.querySelector('#game-canvas');
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const style = window.getComputedStyle(canvas);
        return {
            width: rect.width,
            height: rect.height,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity
        };
    });

    console.log("Canvas Metrics:", JSON.stringify(canvasMetrics, null, 2));
    expect(canvasMetrics, "Map canvas #game-canvas not found").not.toBeNull();
    expect(canvasMetrics!.width, "Map canvas has zero width").toBeGreaterThan(0);
    expect(canvasMetrics!.height, "Map canvas has zero height").toBeGreaterThan(0);
    expect(canvasMetrics!.display, "Map canvas is hidden (display: none)").not.toBe("none");
  };

  const takeBaselineScreenshot = async (name: string) => {
    const vp = page.viewport();
    const width = vp?.width || 1024;
    await page.screenshot({ path: `baseline_${name}_${width}.png` });
    console.log(`Saved baseline_${name}_${width}.png`);
  };

  describe("Desktop (1024x768)", () => {
    beforeAll(async () => {
      await page.setViewport({ width: 1024, height: 768 });
    });

    it("should render soldier cards at full width in Equipment Screen (Campaign)", async () => {
      await page.goto(E2E_URL);
      
      // Mock Campaign State
      const mockState = {
        version: "0.141.3",
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
          baseEnemyCount: 1,
          enemyGrowthPerMission: 1,
          economyMode: "Open",
          skipPrologue: true
        },
        scrap: 500,
        intel: 0,
        currentSector: 1,
        currentNodeId: "node-0",
        nodes: [
          {
            id: "node-0",
            type: "Combat",
            status: "Accessible",
            difficulty: 1,
            rank: 0,
            mapSeed: 123,
            connections: [],
            position: { x: 0, y: 0 },
            bonusLootCount: 0
          }
        ],
        roster: Array.from({ length: 10 }).map((_, i) => ({
          id: `soldier-${i + 1}`,
          name: `Soldier ${i + 1}`,
          archetypeId: "assault",
          hp: 100,
          maxHp: 100,
          status: "Healthy",
          xp: 0,
          level: 1,
          equipment: {
            rightHand: "pistol",
            leftHand: undefined,
            body: "armor_light",
            feet: "boots_speed"
          },
          soldierAim: 65,
          kills: 0,
          missions: 0
        })),
        history: [],
        unlockedArchetypes: ["assault"],
        unlockedItems: []
      };

      await page.evaluate((state) => {
        localStorage.clear();
        localStorage.setItem("voidlock_campaign_v1", JSON.stringify(state));
        window.location.hash = "#campaign";
      }, mockState);

      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);
      await page.waitForSelector('.campaign-node[data-id="node-0"]', { visible: true });

      // Click the node to go to Equipment
      await page.evaluate(() => {
          const el = document.querySelector('.campaign-node[data-id="node-0"]') as HTMLElement;
          if (el) el.click();
      });

      await page.waitForSelector('#screen-equipment', { visible: true });

      await takeBaselineScreenshot('equipment_campaign');

      // Check Left Panel (Squad)
      await checkCardMetrics('.soldier-list-panel .soldier-item', 'Equipment Left Panel');

      // In prologue, squad selection is locked, so we can't remove.
      // But we can click "Recruit" to show available archetypes in the right panel.
      await page.evaluate(() => {
          const recruitBtn = document.querySelector('[data-focus-id="recruit-btn-large"]') as HTMLElement;
          if (recruitBtn) recruitBtn.click();
      });

      // Check Right Panel (Recruitment Roster)
      await checkCardMetrics('.roster-list .soldier-item', 'Equipment Right Panel');
    });

    it("should render soldier cards at full width in Mission Setup Screen (Custom)", async () => {
      await page.goto(E2E_URL);
      await page.waitForSelector('#btn-menu-custom', { visible: true });
      await page.click('#btn-menu-custom');
      await page.waitForSelector('#screen-mission-setup', { visible: true });

      await takeBaselineScreenshot('mission_setup_custom');

      // Check Roster Panel
      await checkCardMetrics('.roster-panel .soldier-item', 'Mission Setup Roster');
    });

    it("should render soldier cards and map canvas correctly in Mission Screen Deployment Phase", async () => {
      await page.goto(E2E_URL);
      await page.waitForSelector('#btn-menu-custom', { visible: true });
      await page.click('#btn-menu-custom');
      await page.waitForSelector('#screen-mission-setup', { visible: true });

      // Ensure Launch Mission button is clickable
      await page.waitForSelector('#btn-launch-mission', { visible: true });
      await page.click('#btn-launch-mission');

      await page.waitForSelector('#screen-mission', { visible: true });
      await page.waitForSelector('.deployment-summary', { visible: true });

      await takeBaselineScreenshot('mission_deployment');

      // Check Map Canvas Visibility (Requirement from voidlock-i374n)
      await checkCanvasVisibility();

      // Check Deployment List (Requirement 5, 6, 7)
      await checkCardMetrics('.deployment-unit-item', 'Mission Deployment List');
    });
  });

  describe("Mobile (400x800)", () => {
    beforeAll(async () => {
      await page.setViewport({ width: 400, height: 800 });
    });

    it("should render soldier cards and map canvas correctly in Mission Screen Deployment Phase", async () => {
      await page.goto(E2E_URL);
      await page.waitForSelector('#btn-menu-custom', { visible: true });
      await page.click('#btn-menu-custom');
      await page.waitForSelector('#screen-mission-setup', { visible: true });

      // Ensure Launch Mission button is clickable
      await page.waitForSelector('#btn-launch-mission', { visible: true });
      await page.click('#btn-launch-mission');

      await page.waitForSelector('#screen-mission', { visible: true });
      await page.waitForSelector('.deployment-summary', { visible: true });

      await takeBaselineScreenshot('mission_deployment_mobile');

      // Check Map Canvas Visibility
      await checkCanvasVisibility();

      // Check Deployment List
      await checkCardMetrics('.deployment-unit-item', 'Mission Deployment List');
    });
  });
});
