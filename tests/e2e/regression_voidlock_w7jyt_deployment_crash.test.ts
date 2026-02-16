import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Repro insertBefore Error", () => {
  let browser: Browser;
  let page: Page;
  let consoleErrors: string[] = [];

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
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
    await browser.close();
  });

  it("should catch the insertBefore NotFoundError when reaching deployment", async () => {
    await page.goto(E2E_URL);
    
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Enable Manual Deployment
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.$eval("#toggle-manual-deployment", (el: any) => el.checked);
    if (!isChecked) {
      await page.click("#toggle-manual-deployment");
    }

    // Launch to Deployment Phase
    await page.click("#btn-launch-mission");
    
    // Wait a bit to ensure no errors occur
    await new Promise(r => setTimeout(r, 2000));

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
  }, 30000);
});
