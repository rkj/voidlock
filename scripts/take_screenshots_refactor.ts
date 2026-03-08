import puppeteer from "puppeteer";

async function takeScreenshots() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  const resolutions = [
    { width: 1024, height: 768, suffix: "1024x768" },
    { width: 400, height: 800, suffix: "400x800" },
  ];

  for (const res of resolutions) {
    await page.setViewport({ width: res.width, height: res.height });
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle2" });

    // Click "Custom Mission"
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#btn-launch-mission");

    // Click "Initialize Expedition" (Launch Mission)
    await page.click("#btn-launch-mission");
    await page.waitForSelector("#screen-mission");

    // Wait for deployment phase to settle
    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: `screenshots/after_deployment_${res.suffix}.png` });

    // Click "Auto-Fill Spawns"
    await page.click("#btn-autofill-deployment");
    await new Promise(r => setTimeout(r, 500));

    // Click "Start Mission"
    await page.click("#btn-start-mission");
    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: `screenshots/after_playing_${res.suffix}.png` });
  }

  await browser.close();
}

takeScreenshots().catch(console.error);
