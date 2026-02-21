const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto('http://localhost:5173');
    
    // Clear localStorage
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Set up custom config
    await page.evaluate(() => {
        const config = {
            mapWidth: 4,
            mapHeight: 4,
            spawnPointCount: 1,
            manualDeployment: false,
            squadConfig: {
                soldiers: [
                    { archetypeId: "assault", tacticalNumber: 1 },
                    { archetypeId: "medic", tacticalNumber: 2 },
                    { archetypeId: "scout", tacticalNumber: 3 },
                    { archetypeId: "heavy", tacticalNumber: 4 }
                ],
                inventory: { medkit: 1 }
            },
            mapGeneratorType: "Procedural"
        };
        localStorage.setItem("voidlock_custom_config", JSON.stringify(config));
    });

    await page.goto('http://localhost:5173');
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Launch Mission
    await page.waitForSelector("#btn-launch-mission");
    await page.click("#btn-launch-mission");

    // Wait for Mission to start
    await page.waitForSelector("#game-canvas");
    await new Promise(r => setTimeout(r, 3000)); // Wait for rendering to settle

    await page.screenshot({ path: 'screenshots/unit_overlap_fix.png' });
    await browser.close();
})();
