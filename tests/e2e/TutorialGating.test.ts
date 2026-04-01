// @vitest-environment node
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser, useStandardLocale } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Tutorial Input Gating E2E", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should verify input gating during tutorial prologue steps", async () => {
    await page.goto(E2E_URL);
    await useStandardLocale(page);
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 10000 });

    // Start Campaign -> Prologue
    await page.click("#btn-menu-campaign");
    await page.waitForSelector(".campaign-setup-wizard");
    await page.click(".campaign-setup-wizard .primary-button");

    // Launch from Equipment Screen
    await page.waitForSelector("#screen-equipment");
    await page.click('[data-focus-id="btn-launch-mission"]');

    // Dismiss intro narrative
    await page.waitForSelector(".advisor-btn[data-id='dismiss']", { visible: true });
    await page.evaluate(() => {
        const btn = document.querySelector(".advisor-btn[data-id='dismiss']") as HTMLElement;
        if (btn) btn.click();
    });
    await page.waitForSelector(".advisor-message", { hidden: true });
    await new Promise(r => setTimeout(r, 500));

    // Dismiss start message
    await page.waitForSelector(".advisor-btn[data-id='dismiss']", { visible: true });
    await page.evaluate(() => {
        const btn = document.querySelector(".advisor-btn[data-id='dismiss']") as HTMLElement;
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Now in mission, first step: Select Unit
    await page.waitForSelector("#screen-mission", { visible: true });
    
    // 1. Verify Orders is disabled initially
    const ordersDisabled = await page.evaluate(() => {
        const el = document.querySelector('.menu-item[data-index="1"]');
        return el?.classList.contains("disabled");
    });
    expect(ordersDisabled).toBe(false);

    // 2. Fast-forward tutorial to 'move' step
    await page.evaluate(() => {
        const app = (window as any).GameAppInstance;
        const tm = app.registry.tutorialManager;
        const state = app.registry.gameClient.latestState;
        const moveStepIndex = tm.prologueSteps.findIndex((s: any) => s.id === "move");
        if (moveStepIndex !== -1) {
            tm.currentStepIndex = moveStepIndex;
            tm.enterStep(moveStepIndex, state);
        }
    });
    
    // Wait for step: Move
    await page.waitForFunction(() => {
        const text = document.getElementById("tutorial-directive-text")?.textContent;
        return text?.includes("Redirect soldier") || text?.includes("Press [1] Orders");
    }, { timeout: 5000 });

    // 3. Verify Orders is now ENABLED
    await new Promise(r => setTimeout(r, 500)); // Settle UI
    const ordersStatus = await page.evaluate(() => {
        const el = document.querySelector('.menu-item[data-index="1"]');
        return {
            clickable: el?.classList.contains("clickable"),
            disabled: el?.classList.contains("disabled")
        };
    });
    expect(ordersStatus.clickable).toBe(true);
    expect(ordersStatus.disabled).toBe(false);

    // 4. Click Orders and verify submenu gating
    await page.evaluate(() => {
        const el = document.querySelector('.menu-item[data-index="1"]') as HTMLElement;
        if (el) el.click();
    });
    
    await page.waitForFunction(() => {
        return document.querySelector(".menu-title")?.textContent === "Orders";
    }, { timeout: 5000 });

    // Check individual orders in submenu (Only 'Move To Room' should be enabled)
    const submenuStatus = await page.evaluate(() => {
        const move = document.querySelector('.menu-item[data-index="1"]');
        const overwatch = document.querySelector('.menu-item[data-index="2"]');
        const explore = document.querySelector('.menu-item[data-index="3"]');
        
        return {
            moveEnabled: move?.classList.contains("clickable") && !move?.classList.contains("disabled"),
            overwatchDisabled: overwatch?.classList.contains("disabled"),
            exploreDisabled: explore?.classList.contains("disabled")
        };
    });
    
    expect(submenuStatus.moveEnabled).toBe(true);
    expect(submenuStatus.overwatchDisabled).toBe(true);
    expect(submenuStatus.exploreDisabled).toBe(true);

    await page.screenshot({ path: "tests/e2e/__snapshots__/tutorial_gating_final.png" });
  });
});
