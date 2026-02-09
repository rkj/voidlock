import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Drawer Toggle Visibility Regression (voidlock-5k8f)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should hide OBJ and SQD buttons on desktop even if mobile-touch class is present", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Force mobile-touch class on body
    await page.evaluate(() => {
      document.body.classList.add("mobile-touch");
    });

    // Check visibility of the buttons
    const btnVisibility = await page.evaluate(() => {
      const sqdBtn = document.getElementById("btn-toggle-squad");
      const objBtn = document.getElementById("btn-toggle-right");
      
      const sqdDisplay = sqdBtn ? window.getComputedStyle(sqdBtn).display : "not found";
      const objDisplay = objBtn ? window.getComputedStyle(objBtn).display : "not found";
      
      return { sqdDisplay, objDisplay };
    });

    console.log("Button displays with mobile-touch on desktop:", btnVisibility);

    // Expect them to be hidden on desktop
    // REPRODUCTION EXPECTATION: They might be 'flex' here if the bug is present
    expect(btnVisibility.sqdDisplay).toBe("none");
    expect(btnVisibility.objDisplay).toBe("none");
  });

  it("should show OBJ and SQD buttons on mobile viewport", async () => {
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Check visibility of the buttons
    const btnVisibility = await page.evaluate(() => {
      const sqdBtn = document.getElementById("btn-toggle-squad");
      const objBtn = document.getElementById("btn-toggle-right");
      
      const sqdDisplay = sqdBtn ? window.getComputedStyle(sqdBtn).display : "not found";
      const objDisplay = objBtn ? window.getComputedStyle(objBtn).display : "not found";
      
      return { sqdDisplay, objDisplay };
    });

    console.log("Button displays on mobile viewport:", btnVisibility);

    // Expect them to be visible on mobile (display: flex due to !important in media query)
    expect(btnVisibility.sqdDisplay).toBe("flex");
    expect(btnVisibility.objDisplay).toBe("flex");
  });
});
