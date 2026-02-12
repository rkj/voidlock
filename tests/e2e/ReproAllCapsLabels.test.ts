import puppeteer, { Browser, Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { E2E_URL } from "./config";

describe("Reproduction: All-caps labels in UI (voidlock-8ai79)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await browser.close();
  });

  const findAllCapsElements = async (selector: string, context: string) => {
    return await page.evaluate((sel, ctx) => {
      const elements = Array.from(document.querySelectorAll(sel));
      const failures: string[] = [];
      const exceptions = ["XP", "HP", "LOS", "LOF", "ID", "POIS", "RH", "LH", "SQD", "OBJ", "VITE", "VOD", "DAG", "CR", "X"];
      
      elements.forEach(el => {
        const text = el.textContent || "";
        const trimmed = text.trim();
        if (trimmed.length > 2) {
          const alphaOnly = trimmed.replace(/[^a-zA-Z]/g, "");
          if (alphaOnly.length > 2 && alphaOnly === alphaOnly.toUpperCase()) {
            if (!exceptions.includes(alphaOnly)) {
              failures.push(`[${ctx}] All-caps text: "${trimmed}" (Selector: ${sel})`);
            }
          }
          
          const style = window.getComputedStyle(el);
          if (style.textTransform === "uppercase") {
            failures.push(`[${ctx}] text-transform uppercase: "${trimmed}" (Selector: ${sel})`);
          }
        }
      });
      return failures;
    }, selector, context);
  };

  test("Specific labels should not be all-caps", async () => {
    const allFailures: string[] = [];
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });

    // 1. Check Soldier Attributes in Equipment Screen
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.click("#btn-goto-equipment");
    
    await page.waitForSelector("#screen-equipment", { visible: true });
    allFailures.push(...await findAllCapsElements("#screen-equipment h2", "Equipment Headers"));
    allFailures.push(...await findAllCapsElements("#screen-equipment h3", "Equipment Subheaders"));

    // 2. Check Debrief Screen labels (MISSION FAILED / RETURN TO COMMAND BRIDGE)
    // Add a soldier so we can start mission
    await page.click("[data-focus-id='soldier-slot-0']");
    await page.waitForSelector(".armory-panel .menu-item.clickable", { visible: true });
    await page.click(".armory-panel .menu-item.clickable");
    
    // Launch mission using GameAppInstance directly
    await page.evaluate(() => {
        const anyWindow = window as any;
        if (anyWindow.GameAppInstance) {
            anyWindow.GameAppInstance.launchMission();
        }
    });
    
    await page.waitForSelector("#screen-mission", { visible: true });
    await new Promise(r => setTimeout(r, 2000));

    // Click "Start Mission" if it exists (Deployment phase)
    const startBtn = await page.$("#btn-start-mission");
    if (startBtn) {
        await startBtn.click();
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Enable debug tools to force lose
    await page.evaluate(() => {
        const anyWindow = window as any;
        if (anyWindow.GameAppInstance && anyWindow.GameAppInstance.context && anyWindow.GameAppInstance.context.gameClient) {
            anyWindow.GameAppInstance.context.gameClient.toggleDebugOverlay(true);
        }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    await page.waitForSelector("#btn-force-lose", { visible: true });
    await page.click("#btn-force-lose");
    
    await page.waitForSelector("#screen-debrief", { visible: true });
    
    allFailures.push(...await findAllCapsElements("#screen-debrief h1", "Debrief Header"));
    allFailures.push(...await findAllCapsElements("#screen-debrief button", "Debrief Buttons"));
    allFailures.push(...await findAllCapsElements("#screen-debrief h2", "Debrief Subheaders"));

    if (allFailures.length > 0) {
        console.log("Reproduction Failures:\n" + allFailures.join("\n"));
        // We expect failures to be found if the bug exists
        expect(allFailures.length).toBeGreaterThan(0);
    } else {
        throw new Error("No all-caps labels found - bug not reproduced!");
    }
  });
});
