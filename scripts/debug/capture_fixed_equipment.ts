import { getNewPage, closeBrowser } from "./tests/e2e/utils/puppeteer";
import { E2E_URL } from "./tests/e2e/config";

async function takeScreenshots() {
  const page = await getNewPage();
  await page.goto(E2E_URL);
  await page.evaluate(() => localStorage.clear());
  await page.goto(E2E_URL);

  // 1. Click "Campaign"
  await page.waitForSelector("#btn-menu-campaign");
  await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 5000 });
  await page.click("#btn-menu-campaign");

  // 2. Start Campaign
  const startBtnSelector = '[data-focus-id="btn-start-campaign"]';
  await page.waitForSelector(startBtnSelector);
  await page.click(startBtnSelector);

  // 3. Select node
  const nodeSelector = ".campaign-node.accessible";
  await page.waitForSelector(nodeSelector);
  await page.click(nodeSelector);

  // 4. Wait for Equipment Screen
  await page.waitForSelector("#screen-equipment");

  // Desktop Screenshot
  await page.setViewport({ width: 1024, height: 768 });
  await page.screenshot({ path: "screenshots/equipment_fixed_desktop.png" });

  // Mobile Screenshot
  await page.setViewport({ width: 400, height: 800 });
  await page.screenshot({ path: "screenshots/equipment_fixed_mobile.png" });

  await closeBrowser();
  console.log("Screenshots taken: screenshots/equipment_fixed_desktop.png, screenshots/equipment_fixed_mobile.png");
}

takeScreenshots().catch(console.error);
