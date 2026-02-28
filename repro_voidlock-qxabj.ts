import puppeteer from "puppeteer";

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  try {
    console.log("Navigating to http://localhost:5199...");
    await page.goto("http://localhost:5199");

    console.log("Waiting for #btn-menu-settings...");
    await page.waitForSelector("#btn-menu-settings", { timeout: 10000 });
    console.log("Clicking #btn-menu-settings...");
    await page.click("#btn-menu-settings");

    console.log("Waiting for #screen-settings...");
    await page.waitForSelector("#screen-settings", { timeout: 10000 });

    // Wait a bit for rendering
    await new Promise(r => setTimeout(r, 1000));

    console.log("Taking screenshot...");
    await page.screenshot({ path: "repro_settings.png" });

    console.log("Taking snapshot...");
    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("HTML length:", html.length);
    
    const h3s = await page.evaluate(() => Array.from(document.querySelectorAll("h3")).map(h => h.textContent));
    console.log("h3 headers:", h3s);

    const screenSettingsStyle = await page.evaluate(() => {
        const el = document.getElementById("screen-settings");
        return el ? window.getComputedStyle(el).display : "NOT FOUND";
    });
    console.log("screen-settings display:", screenSettingsStyle);

    const shellStyle = await page.evaluate(() => {
        const el = document.getElementById("screen-campaign-shell");
        return el ? window.getComputedStyle(el).display : "NOT FOUND";
    });
    console.log("screen-campaign-shell display:", shellStyle);

  } catch (err) {
    console.error("Error during repro:", err);
    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("HTML on error:", html);
  } finally {
    await browser.close();
  }
}

run();
