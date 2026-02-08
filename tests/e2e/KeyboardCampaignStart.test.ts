import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Keyboard Navigation: Campaign Start Reproduction", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    // Ensure clean state
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  }, 20000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should navigate from Main Menu to Sector Map using ONLY keyboard", async () => {
    await page.goto(E2E_URL);

    // 1. Wait for Main Menu and verify initial focus
    await page.waitForSelector("#btn-menu-campaign");
    
    // MainMenuScreen auto-focuses first button in show()
    let activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-campaign");

    // 2. Press Enter to enter Campaign
    await page.keyboard.press("Enter");

    // 3. Wait for New Campaign Wizard
    await page.waitForSelector(".campaign-setup-wizard");
    
    // The Wizard doesn't seem to explicitly focus anything on show.
    // Let's check what is focused.
    activeId = await page.evaluate(() => document.activeElement?.id);
    console.log("Active ID after entering Campaign:", activeId);

    // According to NewCampaignWizard.ts, it renders elements with tabIndex=0.
    // Difficulty cards have tabIndex=0.
    // The first focusable element should be one of the cards if we press Tab.
    
    // Let's try to reach "Initialize Expedition" button using Tab.
    // It's the primary button in the footer.
    
    // We might need to press Tab multiple times.
    // If focus is lost or not working, this will fail.
    
    let found = false;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const text = await page.evaluate(() => document.activeElement?.textContent);
      const id = await page.evaluate(() => document.activeElement?.id);
      const tagName = await page.evaluate(() => document.activeElement?.tagName);
      console.log(`Tab ${i}: <${tagName}> id="${id}" text="${text}"`);
      
      if (text === "Initialize Expedition") {
        found = true;
        break;
      }
    }
    
    expect(found, "Should be able to find 'Initialize Expedition' button using Tab").toBe(true);

    // 4. Press Enter to start campaign
    await page.keyboard.press("Enter");

    // 5. Wait for Sector Map (campaign-node should appear)
    await page.waitForSelector(".campaign-node", { timeout: 5000 });

    // 6. Verify first accessible node is focused or can be reached
    // CampaignScreen auto-focuses? No, pushInputContext just adds trapsFocus: true.
    // It doesn't seem to focus the first node.
    
    activeId = await page.evaluate(() => document.activeElement?.id);
    console.log("Active ID on Sector Map:", activeId);
    
    // Try to focus a node
    await page.keyboard.press("Tab");
    const isNode = await page.evaluate(() => document.activeElement?.classList.contains("campaign-node"));
    expect(isNode, "First Tab on Sector Map should focus a node").toBe(true);
  });
});
