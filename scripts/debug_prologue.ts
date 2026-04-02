import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import * as fs from 'fs';

async function run() {
  const devServer = spawn('npm', ['run', 'dev', '--', '--port', '5199'], { detached: true });

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  let attempts = 0;
  while (attempts < 30) {
    try {
      await page.goto('http://localhost:5199');
      break;
    } catch {
      attempts++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  await page.waitForSelector('#btn-menu-campaign');
  await page.click('#btn-menu-campaign');

  await page.waitForSelector("[data-focus-id='btn-start-campaign']");
  
  const debugDOM = await page.evaluate(() => {
    return {
      duration: !!document.getElementById("campaign-duration"),
      economy: !!document.getElementById("campaign-economy-mode"),
      durationVal: document.getElementById("campaign-duration")?.tagName,
    };
  });
  console.log("DOM DEBUG:", debugDOM);

  await page.click("[data-focus-id='btn-start-campaign']");

  await new Promise(r => setTimeout(r, 3000));

  await browser.close();
  process.kill(-devServer.pid);
}
run();
