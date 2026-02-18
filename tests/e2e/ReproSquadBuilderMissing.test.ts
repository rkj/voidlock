import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("SquadBuilder Missing Reproduction", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should verify that .squad-builder-container is missing during Mission Setup", async () => {
    await page.goto(E2E_URL);

    // 1. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Wait for Mission Setup screen
    await page.waitForSelector("#screen-mission-setup");

    // 3. Take a screenshot for visual verification
    await page.screenshot({
      path: "tests/e2e/__snapshots__/squad_builder_restored.png",
    });

    // 4. Check if .squad-builder-container exists
    const squadBuilderExists = await page.evaluate(() => {
      return document.querySelector(".squad-builder-container") !== null;
    });

    console.log(`SquadBuilder exists: ${squadBuilderExists}`);
    expect(squadBuilderExists).toBe(true);

    // 5. Check if some unit items are rendered
    const unitItemsCount = await page.evaluate(() => {
      return document.querySelectorAll(".squad-builder-container .soldier-item").length;
    });

    console.log(`Unit items in SquadBuilder: ${unitItemsCount}`);
    expect(unitItemsCount).toBeGreaterThan(0);
  });

  it("should verify that .squad-builder-container is present in Campaign Mission Briefing", async () => {
    await page.goto(E2E_URL);

    // 1. Start a new campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-campaign");
        if (btn) btn.click();
    });

    // 2. Click "New Campaign" or select difficulty if Wizard is shown
    await new Promise(r => setTimeout(r, 1000)); // Wait for potential screen transition
    const isWizardShown = await page.evaluate(() => {
        return document.querySelector(".difficulty-card") !== null;
    });

    if (isWizardShown) {
        console.log("Wizard shown, clicking difficulty and start...");
        await page.evaluate(() => {
            const card = document.querySelector(".difficulty-card") as HTMLElement;
            if (card) card.click();
            const startBtn = document.getElementById("btn-wizard-start");
            if (startBtn) startBtn.click();
        });
    } else {
        console.log("Wizard NOT shown, assuming campaign already started or selector changed.");
    }

    await page.screenshot({
        path: "tests/e2e/__snapshots__/debug_wizard_after.png",
    });

    // 3. Select the first node (Start Node)
    await page.waitForSelector(".campaign-node.accessible");
    await page.evaluate(() => {
        const node = document.querySelector(".campaign-node.accessible") as HTMLElement;
        if (node) node.click();
    });

    // 4. Equipment screen should show up. Click "Confirm" to go to Mission Setup
    await page.waitForSelector("#btn-confirm-equipment");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-confirm-equipment");
        if (btn) btn.click();
    });

    // 5. Wait for Mission Setup (Briefing)
    await page.waitForSelector("#screen-mission-setup");
    
    // 6. Check for SquadBuilder
    const squadBuilderExists = await page.evaluate(() => {
      return document.querySelector(".squad-builder-container") !== null;
    });

    await page.screenshot({
        path: "tests/e2e/__snapshots__/squad_builder_campaign.png",
      });

    console.log(`SquadBuilder exists in Campaign: ${squadBuilderExists}`);
    expect(squadBuilderExists).toBe(true);

    const unitItemsCount = await page.evaluate(() => {
        return document.querySelectorAll(".squad-builder-container .soldier-item").length;
      });
  
      console.log(`Unit items in Campaign SquadBuilder: ${unitItemsCount}`);
      // In campaign, we should have at least the 4 initial soldiers in roster or squad
      expect(unitItemsCount).toBeGreaterThan(0);
  });
});
