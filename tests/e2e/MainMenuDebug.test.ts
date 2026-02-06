import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Main Menu Debug", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should capture main menu", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-campaign");
    await page.screenshot({ path: "main_menu_debug.png" });
  });
});
