import { expect, test } from "vitest";
import puppeteer from "puppeteer";
import { E2E_URL } from "./config";

test("UI labels are rendered in all-caps", async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(E2E_URL);
    await page.setViewport({ width: 1024, height: 768 });

    // Helper to get text content
    const getText = async (selector: string) => {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        const el = await page.$(selector);
        if (!el) return null;
        return await page.evaluate((e) => e.textContent, el);
      } catch (e) {
        return null;
      }
    };

    // 1. Navigate to Custom Mission -> Mission Setup
    console.log("Navigating to Custom Mission...");
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup");
    console.log("In Mission Setup");

    // Wait for App to initialize and render SquadBuilder
    await new Promise(r => setTimeout(r, 2000));

    // Log the whole body HTML for debugging
    const bodyHtml = await page.evaluate(() => document.body.innerHTML);
    // console.log("Body HTML:", bodyHtml);
    console.log("Body length:", bodyHtml.length);

    // 2. Add first soldier to squad
    console.log("Waiting for soldier card...");
    const cards = await page.$$(".soldier-card, .soldier-item");
    console.log("Found cards count:", cards.length);

    if (cards.length === 0) {
        // Try to find ANY button in the squad builder
        const buttons = await page.evaluate(() => Array.from(document.querySelectorAll("button")).map(b => b.textContent));
        console.log("All buttons:", buttons);
    }

    await page.waitForSelector(".soldier-card, .soldier-item", { timeout: 15000 });
    await page.click(".soldier-card, .soldier-item");
    console.log("Clicked soldier card");
    
    // 3. Equipment screen check
    await page.click("#btn-goto-equipment");
    console.log("Clicked Equipment & Supplies");
    await page.waitForSelector("#screen-equipment");
    console.log("In Equipment screen");

    const soldierAttributesText = await page.evaluate(() => {
        const h3s = Array.from(document.querySelectorAll("h3"));
        return h3s.map(h => h.textContent);
    });
    console.log("H3s in Equipment screen:", soldierAttributesText);
    // expect(soldierAttributesText).toContain("SOLDIER ATTRIBUTES");

    // 4. Launch Mission to get to Deployment Phase
    await page.click("#btn-launch-mission");
    console.log("Clicked Launch Mission");
    await page.waitForSelector("#screen-mission");
    console.log("In Mission screen");

    // DEPLOYMENT PHASE
    const deploymentPhaseText = await getText(".deployment-title");
    console.log("Deployment Phase text:", deploymentPhaseText);
    expect(deploymentPhaseText).toBe("DEPLOYMENT PHASE");

    // START MISSION
    const startMissionText = await getText("#btn-start-mission");
    console.log("Start Mission text:", startMissionText);
    expect(startMissionText).toBe("START MISSION");

    // 5. OBJECTIVES (HUDManager.ts)
    // Start mission to get out of deployment
    await page.click("#btn-start-mission"); 
    console.log("Clicked Start Mission");
    
    // Wait for "Objectives" to appear in right panel
    const objectivesTitle = await page.evaluate(() => {
        const h3s = Array.from(document.querySelectorAll(".objectives-status h3"));
        return h3s[0]?.textContent;
    });
    console.log("Objectives title:", objectivesTitle);
    expect(objectivesTitle).toBe("OBJECTIVES");

    // 6. OBJECTIVES TOGGLE (index.html)
    const objectivesToggle = await getText("#btn-toggle-right");
    console.log("Objectives toggle text:", objectivesToggle);
    expect(objectivesToggle).toBe("OBJECTIVES");

    // 7. MISSION SUCCESS / FAILED & RETURN TO COMMAND BRIDGE (DebriefScreen.ts)
    // Force win
    await page.keyboard.press("~"); // Toggle debug overlay
    await page.waitForSelector("#btn-force-win");
    await page.click("#btn-force-win");
    await page.waitForSelector(".debrief-screen");

    const debriefHeader = await getText(".debrief-header h1");
    console.log("Debrief header text:", debriefHeader);
    expect(debriefHeader).toBe("MISSION SUCCESS");

    const returnBtn = await getText(".debrief-actions .primary-button");
    console.log("Return button text:", returnBtn);
    expect(returnBtn).toBe("RETURN TO COMMAND BRIDGE");

  } finally {
    await browser.close();
  }
}, 60000);
