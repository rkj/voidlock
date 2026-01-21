import { describe, it, expect, afterAll, beforeEach, afterEach } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Global Error Alert & Reset E2E", () => {
  let page: Page;

  beforeEach(async () => {
    page = await getNewPage();
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('PANIC')) {
            console.log(`[PAGE ${msg.type()}] ${msg.text()}`);
        }
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show confirm dialog on global error and reset data on OK", async () => {
    await page.goto(E2E_URL);
    
    // Set some data in localStorage to verify it gets cleared
    await page.evaluate(() => {
        localStorage.setItem("test-data", "should-be-cleared");
    });

    let dialogHandled = false;
    page.once('dialog', async dialog => {
        await dialog.accept(); // Click OK
        dialogHandled = true;
    });

    // We expect a reload, so we wait for the navigation
    const navigationPromise = page.waitForNavigation({ waitUntil: 'load' });

    // Trigger a global error
    await page.evaluate(() => {
        const script = document.createElement('script');
        script.textContent = 'setTimeout(() => { throw new Error("Test Error for Global Alert"); }, 100);';
        document.body.appendChild(script);
    });

    // Wait for navigation to complete (triggered by window.location.reload() in the dialog handler)
    await navigationPromise;

    expect(dialogHandled).toBe(true);

    const testData = await page.evaluate(() => localStorage.getItem("test-data"));
    expect(testData).toBeNull();
  });

  it("should show panic UI if confirm is cancelled", async () => {
    await page.goto(E2E_URL);
    
    // Set some data in localStorage to verify it NOT cleared
    await page.evaluate(() => {
        localStorage.setItem("test-data-keep", "should-stay");
    });

    let dialogHandled = false;

    page.once('dialog', async dialog => {
        await dialog.dismiss(); // Click Cancel
        dialogHandled = true;
    });

    // Trigger a global error
    await page.evaluate(() => {
        const script = document.createElement('script');
        script.textContent = 'setTimeout(() => { throw new Error("Test Error for Panic UI"); }, 100);';
        document.body.appendChild(script);
    });

    const startTime = Date.now();
    while (!dialogHandled && Date.now() - startTime < 10000) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(dialogHandled).toBe(true);

    // Check if panic UI is shown
    await page.waitForSelector("#screen-main-menu");
    
    const isPanicUIVisible = await page.evaluate(() => {
        const mainMenu = document.getElementById('screen-main-menu');
        if (!mainMenu) return false;
        const style = window.getComputedStyle(mainMenu);
        return style.display === 'flex' && style.zIndex === '99999';
    });
    
    expect(isPanicUIVisible).toBe(true);

    const testData = await page.evaluate(() => localStorage.getItem("test-data-keep"));
    expect(testData).toBe("should-stay");
  });

  it("should show confirm dialog on unhandled promise rejection", async () => {
    await page.goto(E2E_URL);
    
    let dialogHandled = false;
    page.on('dialog', async dialog => {
        dialogHandled = true;
        await dialog.accept();
    });

    // Trigger a global unhandled rejection using a script tag to ensure it's out of evaluate context
    await page.evaluate(() => {
        const script = document.createElement('script');
        script.textContent = 'setTimeout(() => { Promise.reject(new Error("Test Rejection for Global Alert")); }, 100);';
        document.body.appendChild(script);
    });

    const startTime = Date.now();
    while (!dialogHandled && Date.now() - startTime < 10000) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(dialogHandled).toBe(true);
  }, 20000);
});