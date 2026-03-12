import { expect, test } from 'vitest';
import { Page } from 'puppeteer';
import { getNewPage } from './utils/puppeteer';
import { E2E_URL } from './config';

test('Mission screen should fill full height and have no scrollbars', async () => {
  const page = await getNewPage();

  await page.goto(E2E_URL);
  await page.waitForSelector('#btn-menu-custom');
  
  // Go to Custom Mission Setup
  await page.click('#btn-menu-custom');
  await page.waitForSelector('#btn-launch-mission');

  // Set medium-large map size
  await page.evaluate(() => {
    const widthInput = document.getElementById('map-width') as HTMLInputElement;
    const heightInput = document.getElementById('map-height') as HTMLInputElement;
    if (widthInput) widthInput.value = '25';
    if (heightInput) heightInput.value = '25';
    widthInput?.dispatchEvent(new Event('input', { bubbles: true }));
    heightInput?.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Launch Mission
  await page.click('#btn-launch-mission');
  await page.waitForSelector('#screen-mission', { visible: true });
  
  // Wait a bit for everything to settle
  await new Promise(r => setTimeout(r, 1000));

  // Check for scrollbars on the main document
  const hasScrollbars = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return doc.scrollHeight > doc.clientHeight ||
           doc.scrollWidth > doc.clientWidth ||
           body.scrollHeight > body.clientHeight ||
           body.scrollWidth > body.clientWidth;
  });

  // Find elements with overflow auto or scroll
  const overflowingElements = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const results = [];
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.overflow === 'auto' || style.overflow === 'scroll' || 
          style.overflowX === 'auto' || style.overflowX === 'scroll' ||
          style.overflowY === 'auto' || style.overflowY === 'scroll') {
        results.push({
          id: el.id,
          className: el.className,
          tagName: el.tagName,
          overflow: style.overflow,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        });
      }
    }
    return results;
  });

  console.log('Overflowing Elements:', overflowingElements);

  // Take a screenshot for visual inspection
  await page.setViewport({ width: 767, height: 800 });
  await page.screenshot({ path: 'screenshots/mission_layout_repro.png' });

  // Check if #screen-mission fills the viewport
  const screenMissionRect = await page.evaluate(() => {
    const el = document.getElementById('screen-mission');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });

  console.log('Screen Mission Rect:', screenMissionRect);
  console.log('Has Scrollbars:', hasScrollbars);

  // DIAGNOSTIC
  const appChildren = await page.evaluate(() => {
    const app = document.getElementById('app');
    return Array.from(app?.children || []).map(c => ({
      id: c.id,
      className: c.className,
      height: c.getBoundingClientRect().height,
      display: window.getComputedStyle(c).display
    }));
  });
  console.log("App Children:", appChildren);

  // Assertions
  expect(hasScrollbars).toBe(false);
  if (screenMissionRect) {
    expect(screenMissionRect.top).toBeLessThanOrEqual(25);
    expect(screenMissionRect.left).toBeLessThanOrEqual(4);
    expect(screenMissionRect.width).toBeGreaterThanOrEqual(screenMissionRect.viewportWidth - 8);
    expect(screenMissionRect.height).toBeGreaterThanOrEqual(screenMissionRect.viewportHeight - 29);
  }
});
