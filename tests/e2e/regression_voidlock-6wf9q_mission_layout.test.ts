import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { E2E_URL } from './config';

describe('Mission Screen Layout', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should not have scrollbars on the mission screen and #game-container should not have overflow: auto (1024x768)', async () => {
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto(E2E_URL);

    // Navigate to Custom Mission
    await page.waitForSelector('#btn-menu-custom');
    await page.click('#btn-menu-custom');

    // Wait for Mission Setup
    await page.waitForSelector('#screen-mission-setup');

    // Launch Mission
    await page.waitForSelector('#btn-launch-mission');
    await page.click('#btn-launch-mission');

    // Wait for Mission Screen
    await page.waitForSelector('#screen-mission');
    
    // Check #game-container style
    const overflow = await page.evaluate(() => {
      const container = document.getElementById('game-container');
      return container ? window.getComputedStyle(container).overflow : null;
    });

    expect(overflow).not.toBe('auto');

    // Check for scrollbars
    const hasScrollbar = await page.evaluate(() => {
      return document.documentElement.scrollHeight > document.documentElement.clientHeight ||
             document.body.scrollHeight > document.body.clientHeight;
    });

    expect(hasScrollbar).toBe(false);
    
    // Check if #screen-mission fills the viewport
    const missionRect = await page.evaluate(() => {
      const el = document.getElementById('screen-mission');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      };
    });

    expect(missionRect).not.toBeNull();
    if (missionRect) {
      expect(missionRect.width).toBe(1024);
      expect(missionRect.height).toBe(768);
      expect(missionRect.top).toBe(0);
    }

    await page.screenshot({ path: 'screenshots/mission_layout_1024x768.png' });
  });

  it('should not have scrollbars on mobile viewport (400x800)', async () => {
    await page.setViewport({ width: 400, height: 800 });
    await page.goto(E2E_URL);

    // Navigate to Custom Mission
    await page.waitForSelector('#btn-menu-custom');
    
    // Use evaluate to click to avoid Puppeteer's "clickable" checks which can be flaky on mobile layouts
    await page.evaluate(() => {
      const btn = document.getElementById('btn-menu-custom');
      if (btn) btn.click();
    });

    // Wait for Mission Setup
    await page.waitForSelector('#screen-mission-setup');

    // Launch Mission
    await page.waitForSelector('#btn-launch-mission');
    await page.evaluate(() => {
      const btn = document.getElementById('btn-launch-mission');
      if (btn) btn.click();
    });

    // Wait for Mission Screen
    await page.waitForSelector('#screen-mission');
    
    // Check for scrollbars
    const hasScrollbar = await page.evaluate(() => {
      return document.documentElement.scrollHeight > document.documentElement.clientHeight ||
             document.body.scrollHeight > document.body.clientHeight;
    });

    expect(hasScrollbar).toBe(false);
    
    await page.screenshot({ path: 'screenshots/mission_layout_400x800.png' });
  });
});
