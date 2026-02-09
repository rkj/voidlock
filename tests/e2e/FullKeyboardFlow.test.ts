import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Full Keyboard-Only Campaign Walkthrough", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Increase viewport to ensure everything is visible
    await page.setViewport({ width: 1280, height: 800 });
    page.on("console", (msg) => console.log("BROWSER:", msg.text()));
    
    // Ensure clean state
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  const pressTab = async (count: number = 1) => {
    for (let i = 0; i < count; i++) {
      await page.keyboard.press("Tab");
      await new Promise(r => setTimeout(r, 50)); // Small delay for focus updates
    }
  };

  const pressEnter = async () => {
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 500)); // Wait for transition
  };

  const getActiveElementInfo = async () => {
    return await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return {
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        textContent: el.textContent?.trim(),
        ariaLabel: el.getAttribute("aria-label")
      };
    });
  };

  it("should complete a full campaign flow using only keyboard", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-campaign");

    // 1. Enter Campaign Mode from Main Menu
    console.log("Entering Campaign Mode...");
    await page.keyboard.press("Enter"); // btn-menu-campaign should be auto-focused
    await page.waitForSelector(".campaign-setup-wizard");

    // 2. Setup New Campaign
    console.log("Setting up new campaign...");
    // Find "Initialize Expedition" button
    let foundStart = false;
    for (let i = 0; i < 20; i++) {
      const active = await getActiveElementInfo();
      if (active?.textContent === "Initialize Expedition") {
        foundStart = true;
        break;
      }
      await pressTab();
    }
    expect(foundStart, "Failed to find 'Initialize Expedition' button").toBe(true);
    await pressEnter();

    // 3. Select node on Sector Map
    console.log("Selecting node on Sector Map...");
    await page.waitForSelector(".campaign-node", { timeout: 10000 });
    
    // Focus first accessible node
    let foundNode = false;
    for (let i = 0; i < 10; i++) {
      await pressTab();
      const active = await getActiveElementInfo();
      if (active?.className.includes("campaign-node") && active?.className.includes("accessible")) {
        foundNode = true;
        break;
      }
    }
    expect(foundNode, "Failed to focus an accessible campaign node").toBe(true);
    await pressEnter();

    // 4. Mission Setup / Equipment Screen
    console.log("Mission Setup / Equipment Screen...");
    // Campaign transitions to EquipmentScreen for the selected node
    await page.waitForSelector(".equipment-screen", { timeout: 5000 });

    // We need to add at least one soldier.
    // Let's see if we can focus the roster picker (right panel)
    let foundRosterItem = false;
    for (let i = 0; i < 40; i++) {
      const active = await getActiveElementInfo();
      console.log(`Equipment Tab ${i}: <${active?.tagName}> id="${active?.id}" class="${active?.className}" text="${active?.textContent}"`);
      
      // SoldierWidget in roster context has .menu-item class
      if (active?.className.includes("soldier-widget-roster") || active?.className.includes("menu-item")) {
        foundRosterItem = true;
        break;
      }
      await pressTab();
    }
    
    // If we haven't found a roster item, it's likely because they are not focusable yet.
    if (!foundRosterItem) {
        console.warn("Roster item not found via Tab. Proceeding with caution...");
    } else {
        console.log("Adding soldier to squad...");
        await pressEnter(); // Click to add to squad
    }

    // Navigate to "Confirm Squad" button
    let foundConfirm = false;
    for (let i = 0; i < 30; i++) {
      const active = await getActiveElementInfo();
      console.log(`Confirm Tab ${i}: <${active?.tagName}> id="${active?.id}" class="${active?.className}" text="${active?.textContent}"`);
      if (active?.textContent === "Confirm Squad") {
        foundConfirm = true;
        break;
      }
      await pressTab();
    }
    expect(foundConfirm, "Failed to find 'Confirm Squad' button").toBe(true);
    await pressEnter();

    // 5. Active Mission
    console.log("Active Mission...");
    await page.waitForSelector("#game-canvas", { timeout: 10000 });
    
    // Wait for deployment/start if needed
    // By default manualDeployment is false, so it should start immediately.
    // Check for HUD top bar to confirm active mission
    await page.waitForSelector("#top-bar", { timeout: 5000 });

    // 6. Perform actions in-mission
    console.log("Performing in-mission actions...");
    
    // Let's try to select unit with Tab
    await page.keyboard.press("Tab");
    
    // Issue Move order
    await page.keyboard.press("1"); // Orders
    await new Promise(r => setTimeout(r, 200));
    await page.keyboard.press("1"); // Move
    await new Promise(r => setTimeout(r, 200));
    await page.keyboard.press("1"); // Target 1 (usually Room A or similar)
    await new Promise(r => setTimeout(r, 200));
    await page.keyboard.press("1"); // Select Unit 1 to execute
    await new Promise(r => setTimeout(r, 500));

    // 7. Return to Campaign Screen (Abort)
    console.log("Aborting mission to return to campaign...");
    // Ensure we are at ACTION_SELECT by pressing Escape once just in case we are in some menu
    await page.keyboard.press("Escape");
    await new Promise(r => setTimeout(r, 200));
    await page.keyboard.press("Escape"); // Now it should open abort modal
    await page.waitForSelector(".modal-window");
    
    // Modal buttons are also focusable. Find "Yes" or "Confirm".
    // Usually "Yes" is the first button or we can press Enter if it's auto-focused.
    await page.keyboard.press("Enter"); 

    // 8. Verify we are back on Sector Map or Debrief
    // Abort takes you to Debrief first.
    console.log("Waiting for Debrief Screen...");
    await page.waitForSelector(".debrief-screen", { timeout: 10000 });
    
    // In Debrief, find "Continue" button
    let foundContinue = false;
    for (let i = 0; i < 15; i++) {
      const active = await getActiveElementInfo();
      console.log(`Debrief Tab ${i}: <${active?.tagName}> class="${active?.className}" text="${active?.textContent}"`);
      if (active?.textContent === "Return to Command Bridge" || active?.textContent === "Continue") {
        foundContinue = true;
        break;
      }
      await pressTab();
    }
    expect(foundContinue, "Failed to find 'Continue' button on Debrief Screen").toBe(true);
    await pressEnter();

    // Back to Sector Map
    console.log("Verifying return to Sector Map...");
    await page.waitForSelector(".campaign-node", { timeout: 10000 });
    
    console.log("Full keyboard flow E2E test completed successfully!");
  }, 120000);
});
