import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Equipment Screen Layout Clipping Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should reproduce layout clipping on the Equipment Screen at small viewports", async () => {
    // 1. Set a small viewport where clipping is expected
    await page.setViewport({ width: 600, height: 400 });

    await page.goto(E2E_URL);
    await page.evaluate(
      (config) => {
        localStorage.clear();
        localStorage.setItem("voidlock_custom_config", JSON.stringify(config));
        window.location.reload();
      },
      {
        mapWidth: 14,
        mapHeight: 14,
        spawnPointCount: 5,
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        losOverlayEnabled: false,
        agentControlEnabled: true,
        allowTacticalPause: true,
        unitStyle: "TacticalIcons",
        mapGeneratorType: "TreeShip",
        missionType: "Default",
        lastSeed: 12345,
        startingThreatLevel: 0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        bonusLootCount: 0,
        squadConfig: {
          soldiers: Array.from({ length: 100 }, (_, i) => ({
            id: `soldier-${i}`,
            archetypeId:
              i % 4 === 0
                ? "assault"
                : i % 4 === 1
                  ? "medic"
                  : i % 4 === 2
                    ? "heavy"
                    : "scout",
            hp: 100,
            maxHp: 100,
            soldierAim: 70,
          })),
          inventory: { medkit: 2, frag_grenade: 2 },
        },
      },
    );

    await page.waitForNavigation();

    // 2. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 3. Wait for Mission Setup and trigger Equipment Screen
    await page.waitForSelector("#screen-mission-setup", { visible: true });

    // We bypass the UI button click here to ensure we reach the Equipment Screen
    // even if the small viewport makes the button hard to click in the E2E environment.
    await page.evaluate(() => {
      const app = (window as any).GameAppInstance;
      app.equipmentScreen.updateConfig(app.currentSquad);
      app.context.screenManager.show("equipment");
    });

    // 4. Wait for Equipment Screen content
    await page.waitForSelector("#screen-equipment", { visible: true });
    await page.waitForSelector(".panel", { visible: true });

    // 5. Take a screenshot for visual verification
    await page.screenshot({
      path: "tests/e2e/__snapshots__/equipment_screen_clipping_repro.png",
    });

    // 6. Check for horizontal and vertical clipping
    const clippingStats = await page.evaluate(() => {
      const screen = document.getElementById("screen-equipment");
      if (!screen) return { error: "Screen not found" };

      const panels = Array.from(screen.querySelectorAll(".panel"));
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const panelStats = panels.map((p) => {
        const rect = p.getBoundingClientRect();
        const scrollable = p.scrollHeight > p.clientHeight;
        return {
          title: p.querySelector(".panel-title")?.textContent,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          isOffScreenX: rect.right > viewportWidth || rect.left < 0,
          isOffScreenY: rect.bottom > viewportHeight || rect.top < 0,
          scrollable,
        };
      });

      // Try to find the footer
      const footer = screen.querySelector(
        ".flex-row.justify-end.p-10.gap-10",
      ) as HTMLElement;
      const footerRect = footer?.getBoundingClientRect();

      const shell = document.getElementById("campaign-shell-content");
      const shellRect = shell?.getBoundingClientRect();

      return {
        panelStats,
        viewportWidth,
        viewportHeight,
        isFooterInViewport: footerRect
          ? footerRect.bottom <= viewportHeight &&
            footerRect.top >= 0 &&
            footerRect.right <= viewportWidth &&
            footerRect.left >= 0
          : false,
        isClippedByShell:
          shellRect && footerRect
            ? footerRect.bottom > shellRect.bottom
            : false,
      };
    });

    // ASSERTION: We expect NO clipping and correctly functioning scrollbars.
    // If the fix (min-height: 0) is missing, these will fail.
    expect(
      clippingStats.isFooterInViewport,
      "Footer is clipped/off-screen",
    ).toBe(true);
    expect(
      clippingStats.isClippedByShell,
      "Footer is clipped by shell content",
    ).toBe(false);

    const allPanelsScrollable = clippingStats.panelStats?.every(
      (p) => p.scrollable,
    );
    expect(
      allPanelsScrollable,
      "One or more panels are NOT scrollable even with many items",
    ).toBe(true);
  });
});
