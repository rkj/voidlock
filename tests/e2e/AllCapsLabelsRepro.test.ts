import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("UI labels are rendered in Title Case", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
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

    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Navigate to Custom Mission -> Mission Setup
    console.log("Navigating to Custom Mission...");
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup");
    console.log("In Mission Setup");

    // Wait for App to initialize and render SquadBuilder
    await new Promise(r => setTimeout(r, 2000));

    // 2. Add first soldier to squad
    console.log("Waiting for soldier card...");
    await page.waitForSelector(".roster-list .soldier-card, .roster-list .soldier-item", { timeout: 15000 });
    await page.click(".roster-list .soldier-card, .roster-list .soldier-item");
    console.log("Clicked soldier card");
    
    // 3. Equipment screen check
    await page.click("#btn-goto-equipment");
    console.log("Clicked Equipment & Supplies");
    await page.waitForSelector("#screen-equipment");
    console.log("In Equipment screen");

    const soldierAttributesText = await page.evaluate(() => {
        const h3s = Array.from(document.querySelectorAll("#screen-equipment h3"));
        return h3s.map(h => h.textContent?.trim());
    });
    console.log("H3s in Equipment screen:", soldierAttributesText);
    expect(soldierAttributesText).toContain("Soldier Attributes");

    // 4. Confirm Squad to go back to Setup
    await page.click("[data-focus-id='btn-confirm-squad']");
    await page.waitForSelector("#screen-mission-setup");

    // Launch Mission to get to Deployment Phase
    await page.click("#btn-launch-mission");
    console.log("Clicked Launch Mission");
    await page.waitForSelector("#screen-mission");
    console.log("In Mission screen");

    // Deployment Phase
    const deploymentPhaseText = await getText(".deployment-title");
    console.log("Deployment Phase text:", deploymentPhaseText);
    expect(deploymentPhaseText).toBe("Deployment Phase");

    // Autofill deployment to enable Start Mission
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.click("#btn-autofill-deployment");
    
    // Start Mission
    await page.waitForSelector("#btn-start-mission:not([disabled])", { visible: true });
    const startMissionText = await getText("#btn-start-mission");
    console.log("Start Mission text:", startMissionText);
    expect(startMissionText).toBe("Start Mission");

    // 5. Objectives (HUDManager.ts)
    // Start mission to get out of deployment
    await page.click("#btn-start-mission"); 
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
    await page.keyboard.press("~"); // Toggle debug overlay
    await page.waitForSelector("#btn-force-win");
    await page.click("#btn-force-win");
    await page.waitForSelector("#screen-debrief", { visible: true });

    const debriefHeader = await getText("#screen-debrief .debrief-header");
    console.log("Debrief header text:", debriefHeader);
    expect(debriefHeader).toBe("Mission Success");

    const returnBtn = await getText(".debrief-footer .debrief-button");
    console.log("Return button text:", returnBtn);
    expect(returnBtn).toBe("Return to Command Bridge");
  }, 60000);
});
