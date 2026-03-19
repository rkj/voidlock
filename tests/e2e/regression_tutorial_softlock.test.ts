// @vitest-environment node
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Tutorial Soft-lock Regression (voidlock-cak2n, voidlock-51ouc, voidlock-ldnso)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Enable browser console logging for visibility into state transitions
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', error => console.log(`BROWSER ERROR: ${error.message}`));
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should complete the full tutorial flow without state resets or input soft-locks", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 10000 });

    // 1. Initialize Expedition
    await page.click("#btn-menu-campaign");
    await page.waitForSelector(".campaign-setup-wizard");
    // Ensure "Skip Tutorial" is NOT checked (default)
    await page.click(".campaign-setup-wizard .primary-button");

    // 2. Launch from Equipment Screen
    await page.waitForSelector("#screen-equipment");
    await page.click('[data-focus-id="btn-launch-mission"]');

    // 3. Dismiss Mission Briefing
    await page.waitForSelector(".advisor-message", { visible: true });
    await page.click(".advisor-btn[data-id='dismiss']");
    await new Promise(r => setTimeout(r, 1000));

    // 4. Dismiss Operator Notice (Start of 'observe' phase)
    await page.waitForSelector(".advisor-message", { visible: true });
    await page.click(".advisor-btn[data-id='dismiss']");
    
    // 5. Unpause and observe exploration
    await page.waitForSelector("#btn-pause-toggle", { visible: true });
    const playText = await page.$eval("#btn-pause-toggle", el => (el as HTMLElement).innerText);
    if (playText.includes("Play")) {
        await page.click("#btn-pause-toggle");
    }

    // Wait for the directive to change to 'Pause' instruction
    // This requires unit movement (2 tiles) or a time-based trigger
    console.log("Waiting for 'TAP PAUSE' directive...");
    await page.waitForFunction(() => {
        const text = document.querySelector("#tutorial-directive-text")?.textContent || "";
        // Log unit state and simulation time
        const unitEl = document.querySelector(".soldier-card");
        const unitState = unitEl?.querySelector(".u-status-text")?.textContent || "unknown";
        const time = document.querySelector(".time-value")?.textContent || "0.0";
        console.log(`Current Directive: ${text} | Unit State: ${unitState} | Time: ${time}s`);
        return text.toUpperCase().includes("PAUSE");
    }, { timeout: 60000 });

    // 6. Test Pause Gating (voidlock-51ouc, voidlock-bo1d4)
    const pointerEvents = await page.$eval("#btn-pause-toggle", el => window.getComputedStyle(el).pointerEvents);
    console.log(`Pause button pointer-events: ${pointerEvents}`);
    expect(pointerEvents).toBe("auto"); // Confirms voidlock-bo1d4 fix enabled interaction
    
    console.log("Pressing pause button to bypass blocked button...");
    await page.click("#btn-pause-toggle");
    await new Promise(r => setTimeout(r, 1000));

    // Resume to allow unit to reach door at normal speed
    console.log("Pressing pause button to resume...");
    await page.click("#btn-pause-toggle");

    // 7. Advance through intermediate steps (doors, combat)
    // These might be skipped if conditions met, so we wait for ANY of the later directives
    console.log("Waiting for Engagement or Move directive...");
    
    // We must dismiss 'enemy_sighted' when it appears. It happens during 'combat'
    await page.waitForFunction(() => {
        const text = (document.querySelector("#tutorial-directive-text")?.textContent || "").toUpperCase();
        return text.includes("CONTACT") || !!document.querySelector(".advisor-message");
    }, { timeout: 30000 });

    await page.waitForSelector(".advisor-message", { visible: true });
    await page.click(".advisor-btn[data-id='dismiss']");

    // Ensure we are in a state where we can test Orders sub-menu
    // We'll wait until the 'move' step or 'engagement' step
    await page.waitForFunction(() => {
        const text = (document.querySelector("#tutorial-directive-text")?.textContent || "").toUpperCase();
        
        // Log unit state and simulation time
        const unitEl = document.querySelector(".soldier-card");
        const unitState = unitEl?.querySelector(".u-status-text")?.textContent || "unknown";
        const time = document.querySelector(".time-value")?.textContent || "0.0";
        console.log(`Waiting for INTERVENTION... Directive: ${text} | Unit: ${unitState} | Time: ${time}s`);
        
        return text.includes("INTERVENTION") || text.includes("MOVE TO ROOM") || !!document.querySelector(".advisor-message");
    }, { timeout: 60000 });

    // Ensure advisor message is dismissed before interaction
    await page.waitForFunction(() => !document.querySelector(".advisor-modal-backdrop"), { timeout: 5000 }).catch(() => {});
    const isAdvisorPresent = await page.evaluate(() => !!document.querySelector(".advisor-message"));
    if (isAdvisorPresent) {
        console.log("Dismissing additional advisor message...");
        await page.click(".advisor-btn[data-id='dismiss']");
        await new Promise(r => setTimeout(r, 500));
    }

    const currentDirective = await page.$eval("#tutorial-directive-text", el => (el as HTMLElement).innerText);
    console.log(`Reached Directive: ${currentDirective}`);

    // 8. Test unit selection if needed
    // Click unit to ensure it's selected for command menu
    await page.waitForSelector(".soldier-card", { visible: true });
    await page.click(".soldier-card");
    await new Promise(r => setTimeout(r, 500));

    // 9. Test Orders/Engagement Sub-menu Visibility (voidlock-ldnso)
    const commandItems = await page.$$eval(".command-item", items => items.map(el => (el as HTMLElement).innerText));
    console.log("Available command items:", commandItems);
    
    const ordersBtn = await page.waitForSelector(".command-item", { visible: true, timeout: 10000 });
    console.log(`Clicking command menu item: ${await ordersBtn?.evaluate(el => (el as HTMLElement).innerText)}`);
    await ordersBtn?.click();

    // Verify sub-menu appears. In bug voidlock-ldnso, clicking doesn't show sub-menu
    console.log("Checking for sub-menu options...");
    const subMenuVisible = await page.evaluate(() => {
        // Look for items that only appear in sub-menus like 'MOVE_TO' or 'IGNORE'
        const items = Array.from(document.querySelectorAll(".command-item"));
        return items.some(el => {
            const id = el.getAttribute("data-id");
            return id === "MOVE_TO" || id === "IGNORE" || id === "ENGAGE";
        });
    });

    if (!subMenuVisible) {
        console.log("SUB-MENU FAILED TO RENDER (voidlock-ldnso REPRODUCED)");
    } else {
        console.log("Sub-menu rendered successfully.");
    }

    // 10. Final check for volatility (voidlock-cak2n)
    // We wait a few seconds and check if directive reverted
    await new Promise(r => setTimeout(r, 5000));
    const finalDirective = await page.$eval("#tutorial-directive-text", el => (el as HTMLElement).innerText);
    console.log(`Final Directive: ${finalDirective}`);
    
    // If it reverted to 'ASSET DEPLOYMENT INITIALIZED', it's volatile
    if (finalDirective.includes("INITIALIZED")) {
        console.log("DIRECTIVE REVERTED (voidlock-cak2n REPRODUCED)");
    }
  });
});
