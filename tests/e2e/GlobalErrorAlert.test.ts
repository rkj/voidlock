import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";

describe("Global Error Alert & Reset E2E", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('PANIC')) {
            console.log(`[PAGE ${msg.type()}] ${msg.text()}`);
        }
    });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show confirm dialog on global error and reset data on OK", async () => {
    await page.goto("http://localhost:5173");
    
    // Set some data in localStorage to verify it gets cleared
    await page.evaluate(() => {
        localStorage.setItem("test-data", "should-be-cleared");
    });

    let dialogHandled = false;
    page.once('dialog', async dialog => {
        // We don't need to check message here as we did in previous run, 
        // focus on verifying the reload/reset action.
        await dialog.accept(); // Click OK
        dialogHandled = true;
    });

    // We expect a reload, so we wait for the navigation
    // We start waiting BEFORE triggering the error
    const navigationPromise = page.waitForNavigation({ waitUntil: 'load' });

    // Trigger a global error
    await page.evaluate(() => {
        setTimeout(() => {
            throw new Error("Test Error for Global Alert");
        }, 100);
    });

    // Wait for navigation to complete (triggered by window.location.reload() in the dialog handler)
    await navigationPromise;

    expect(dialogHandled).toBe(true);

    const testData = await page.evaluate(() => localStorage.getItem("test-data"));
    expect(testData).toBeNull();
  });

  it("should show panic UI if confirm is cancelled", async () => {
    // Start with a clean page to avoid leftovers
    await page.goto("http://localhost:5173");
    
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
        setTimeout(() => {
            console.log("Triggering test error for panic UI...");
            throw new Error("Test Error for Panic UI");
        }, 100);
    });

    const startTime = Date.now();
    while (!dialogHandled && Date.now() - startTime < 10000) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(dialogHandled).toBe(true);

    // Check if panic UI is shown
    // In index.html, panic UI forces screen-main-menu to be visible with special styles
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
    await page.goto("http://localhost:5173");
    
    let dialogHandled = false;
    page.once('dialog', async dialog => {
        dialogHandled = true;
        await dialog.accept();
    });

    await page.evaluate(() => {
        setTimeout(() => {
            Promise.reject("Test Rejection for Global Alert");
        }, 100);
    });

    const startTime = Date.now();
    while (!dialogHandled && Date.now() - startTime < 10000) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(dialogHandled).toBe(true);
  });
});
