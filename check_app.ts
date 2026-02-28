import puppeteer from "puppeteer";

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to http://localhost:5199...");
    await page.goto("http://localhost:5199");
    
    const title = await page.title();
    console.log("Page title:", title);
    
    const htmlLength = await page.evaluate(() => document.body.innerHTML.length);
    console.log("HTML length:", htmlLength);
    
    const hasError = await page.evaluate(() => {
        return !!document.querySelector(".error-message") || !!document.querySelector("pre");
    });
    console.log("Has error elements:", hasError);
    
    if (hasError) {
        const errorContent = await page.evaluate(() => document.body.innerText);
        console.log("Error content:", errorContent);
    }

    const consoleLogs: string[] = [];
    page.on("console", msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    
    // Trigger Settings click
    console.log("Clicking Settings...");
    await page.click("#btn-menu-settings");
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Console logs:", consoleLogs);
    
    const screenSettingsVisible = await page.evaluate(() => {
        const el = document.getElementById("screen-settings");
        return el ? window.getComputedStyle(el).display !== "none" : "NOT FOUND";
    });
    console.log("Screen settings visible:", screenSettingsVisible);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

run();
