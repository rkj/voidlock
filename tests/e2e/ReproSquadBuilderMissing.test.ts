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

  it("should verify that .squad-builder-container is present during Mission Setup", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

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

  it.skip("should verify that .squad-builder-container is present in Campaign Mission Briefing", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Start a new campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

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
            const startBtn = document.querySelector('[data-focus-id="btn-start-campaign"]') as HTMLElement;
            if (startBtn) startBtn.click();
        });
    }

    await page.screenshot({
        path: "tests/e2e/__snapshots__/debug_wizard_after.png",
    });

    // 3. Select the first node (Start Node)
    await page.waitForSelector(".campaign-node.accessible");
    await page.click(".campaign-node.accessible");

    // 4. Equipment screen should show up. Click "Confirm Squad" to go to Mission Setup
    await page.waitForSelector("[data-focus-id='btn-back']", { visible: true });
    await page.click("[data-focus-id='btn-back']");

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
