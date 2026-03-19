import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closePage } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Repro insertBefore Error", () => {
  let page: Page;
  let consoleErrors: string[] = [];

  beforeAll(async () => {
    page = await getNewPage();
    page.on("pageerror", (err) => {
      consoleErrors.push("PAGE ERROR: " + err.message + "\n" + err.stack);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push("CONSOLE ERROR: " + msg.text());
      }
    });
  });

  afterAll(async () => {
    await closePage(page);
  });

  it("should catch the insertBefore NotFoundError when reaching deployment", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 15000 });
    
    await page.waitForSelector("#btn-menu-custom");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-custom");
        if (btn) btn.click();
    });

    // Enable Manual Deployment
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.$eval("#toggle-manual-deployment", (el: any) => el.checked);
    if (!isChecked) {
      await page.evaluate(() => {
          const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
          if (el) el.click();
      });
    }

    // Launch to Deployment Phase
    await page.waitForSelector("#btn-launch-mission:not([disabled])", { visible: true, timeout: 15000 });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission");
        if (btn) btn.click();
    });
    
    // Wait for the mission screen and deployment HUD to appear
    await page.waitForSelector(".deployment-summary", { visible: true, timeout: 15000 });

    console.log("Console Errors found:", consoleErrors);
    
    expect(consoleErrors).toHaveLength(0);
    
    // Also verify that the deployment summary is visible
    const deploymentSummary = await page.$(".deployment-summary");
    expect(deploymentSummary).not.toBeNull();

    // And verify the buttons are there
    const autoFillBtn = await page.$("#btn-autofill-deployment");
    expect(autoFillBtn).not.toBeNull();
    const startBtn = await page.$("#btn-start-mission");
    expect(startBtn).not.toBeNull();
  }, 60000);
});
