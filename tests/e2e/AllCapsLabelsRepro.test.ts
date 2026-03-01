import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("UI labels are rendered in Title Case", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
    page.on('console', msg => console.log('BROWSER:', msg.text()));
  });

  afterAll(async () => {
    await closeBrowser();
  });

  test("UI labels are rendered in Title Case", async () => {
    // Helper to get text content
    const getText = async (selector: string) => {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        const el = await page.$(selector);
        if (!el) return null;
        return await page.evaluate((e) => e.textContent?.trim(), el);
      } catch (e) {
        return null;
      }
    };

    await page.goto(E2E_URL, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    
    // Wait for App to be ready
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);
    
    await page.waitForSelector("#btn-menu-custom");

    // 1. Navigate to Custom Mission -> Mission Setup
    console.log("Navigating to Custom Mission...");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup", { visible: true });
    console.log("In Mission Setup");

    // Wait for App to initialize and render SquadBuilder
    await new Promise(r => setTimeout(r, 2000));

    // 2. Add first soldier to squad
    console.log("Waiting for soldier card...");
    await page.waitForSelector(".roster-list .soldier-card");
    const cards = await page.$$(".roster-list .soldier-card");
    console.log(`Found ${cards.length} cards in roster`);
    await cards[0].click();
    console.log("Clicked first soldier card");
    
    // Wait for state propagation and UI render
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: "tests/e2e/__snapshots__/debug_after_roster_click.png" });
    
    // 3. Equipment screen check
    console.log("Clicking Equipment & Supplies via evaluate...");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (btn) btn.click();
        else console.log("btn-goto-equipment NOT FOUND in evaluate");
    });
    await page.waitForSelector("#screen-equipment", { visible: true, timeout: 10000 });
    console.log("In Equipment screen");

    // Wait a bit more for inspector to render
    await new Promise(r => setTimeout(r, 1000));

    const soldierAttributesText = await page.evaluate(() => {
        const h3s = Array.from(document.querySelectorAll("#screen-equipment h3"));
        return h3s.map(h => h.textContent?.trim());
    });
    console.log("H3s in Equipment screen:", soldierAttributesText);
    expect(soldierAttributesText).toContain("Soldier Attributes");

    // 4. Confirm Squad to go back to Setup
    await page.evaluate(() => {
        const btn = document.querySelector("[data-focus-id='btn-back']") as HTMLElement;
        if (btn) btn.click();
    });
    await page.waitForSelector("#screen-mission-setup", { visible: true });

    // Launch Mission to get to Deployment Phase
    await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission");
        if (btn) btn.click();
    });
    console.log("Clicked Launch Mission");
    await page.waitForSelector("#screen-mission", { visible: true });
    console.log("In Mission screen");

    // Deployment Phase
    const deploymentPhaseText = await getText(".deployment-title");
    console.log("Deployment Phase text:", deploymentPhaseText);
    expect(deploymentPhaseText).toBe("Deployment Phase");

    // Autofill deployment to enable Start Mission
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-autofill-deployment");
        if (btn) btn.click();
    });
    
    // Wait for state update
    await new Promise(r => setTimeout(r, 1000));
    
    // Start Mission
    await page.waitForSelector("#btn-start-mission:not([disabled])", { visible: true, timeout: 10000 });
    const startMissionText = await getText("#btn-start-mission");
    console.log("Start Mission text:", startMissionText);
    expect(startMissionText).toBe("Start Mission");

    // 5. Objectives (HUDManager.ts)
    // Start mission to get out of deployment
    await page.evaluate(() => {
        const btn = document.getElementById("btn-start-mission");
        if (btn) btn.click();
    }); 
    console.log("Clicked Start Mission");
    
    // Wait for "Objectives" to appear in right panel
    await page.waitForSelector(".objectives-status h3", { visible: true });
    const objectivesTitle = await page.evaluate(() => {
        const h3s = Array.from(document.querySelectorAll(".objectives-status h3"));
        return h3s[0]?.textContent?.trim();
    });
    console.log("Objectives title:", objectivesTitle);
    expect(objectivesTitle).toBe("Objectives");

    // 6. Objectives toggle (index.html)
    const objectivesToggle = await getText("#btn-toggle-right");
    console.log("Objectives toggle text:", objectivesToggle);
    expect(objectivesToggle).toBe("Objectives");

    // 7. Mission Success / Failed & Return to Command Bridge (DebriefScreen.ts)
    // Force win
    await page.keyboard.press("Backquote"); // Toggle debug overlay (Spec 8.2)
    await page.waitForSelector("#btn-force-win", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-force-win");
        if (btn) btn.click();
    });
    await page.waitForSelector("#screen-debrief", { visible: true, timeout: 10000 });

    const debriefHeader = await getText("#screen-debrief .debrief-header");
    console.log("Debrief header text:", debriefHeader);
    expect(debriefHeader).toBe("Mission Success");

    const returnBtn = await getText(".debrief-footer .debrief-button");
    console.log("Return button text:", returnBtn);
    expect(returnBtn).toBe("Return to Command Bridge");
  }, 60000);
});
