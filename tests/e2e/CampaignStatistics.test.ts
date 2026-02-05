
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('Campaign Statistics E2E', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true, // Use headless for CI/Verification
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should display Statistics screen with correct shell tabs and footer layout', async () => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#app');

    // We need to trigger the Statistics mode.
    // The issue is "Add a back tab to Statistics mode...". 
    // Usually accessible from Main Menu -> Statistics (if implemented) or Campaign -> Service Record.
    
    // Check if there is a "Service Record" button in Main Menu (if that's how it's accessed)
    // Or if we need to start a campaign first.
    // Based on CampaignShell code, Statistics mode is a top level mode.
    // Let's assume there is a way to get there.
    // If not, we might need to rely on URL hash if router is used, but CampaignShell seems to use internal state.
    // However, the task says "Statistics screen navigation".
    // Let's try to find a button "Service Record" or "Statistics" on the main menu.
    
    // Wait for main menu
    await page.waitForSelector('#screen-main-menu', { timeout: 5000 });
    
    // Click "Statistics" button in Main Menu
    const statsBtn = await page.waitForSelector('#btn-menu-statistics');
    if (!statsBtn) throw new Error("Statistics button not found");
    await statsBtn.click();
    
    // Now we should be in Statistics Screen (or overlay)
    await page.waitForSelector('#screen-statistics', { visible: true });
    
    // 1. Verify "Main Menu" tab exists
    // The tabs are in #screen-campaign-shell (top bar), which persists.
    // We need to wait for the shell to update.
    await page.waitForSelector('#screen-campaign-shell button');
    
    const mainMenuTab = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#screen-campaign-shell button'))
            .some(b => b.textContent?.includes('Main Menu'));
    });
    expect(mainMenuTab).toBe(true);
    
    // 2. Verify Footer "leak" fix
    // We need to ensure that when we are in Statistics, the Campaign Screen footer is NOT visible or interfering.
    // However, to verify the CSS fix (flex-shrink: 0), we should check the computed style of the footer itself.
    // Since we are in Statistics, the Campaign Screen might be hidden.
    // If we can navigate back to Campaign, we can check it.
    
    // Let's check if we can go back to Main Menu using the new tab!
    const backTab = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll('#screen-campaign-shell button'))
            .find(b => b.textContent?.includes('Main Menu'));
    });
    
    if (backTab.asElement()) {
        await backTab.asElement()?.click();
    } else {
        throw new Error("Main Menu tab not found to click back");
    }
    
    // Should be back at main menu
    await page.waitForSelector('#screen-main-menu', { visible: true });
    
    // Now let's start a campaign to verify the footer style.
    // Click "New Campaign"
    const newCampaignBtn = await page.waitForSelector('#btn-menu-campaign');
    await newCampaignBtn?.click();
    
    // Wait for Wizard or Campaign Screen?
    // Based on GameApp, onCampaignMenu -> shows Campaign Summary if state exists, or Campaign Screen?
    // Wait, onCampaignMenu calls `campaignFlowCoordinator.onCampaignMenu`.
    // Let's assume it goes to New Campaign Wizard if no campaign.
    
    // Just in case, try to clear data first if needed.
    // But let's check if we see "New Expedition" (Wizard)
    
    // We expect to be in the wizard now.
    // Use a more generic selector for the wizard container
    await page.waitForSelector('.campaign-setup-wizard', { timeout: 5000 });
        
    // In Wizard, the footer is also rendered (based on NewCampaignWizard.ts changes).
    // Let's check footer here.
    const footer = await page.waitForSelector('.campaign-footer', { timeout: 5000 });
    if (!footer) throw new Error("Campaign footer not found");
    
    const footerStyle = await page.evaluate(() => {
        const el = document.querySelector('.campaign-footer');
        if (!el) return null;
        const style = window.getComputedStyle(el);
        return {
            position: style.position,
            flexShrink: style.flexShrink
        };
    });
    
    expect(footerStyle).not.toBeNull();
    // The fix changed position from 'absolute' to static (flex child) or specifically removed absolute.
    // Default position is static.
    expect(footerStyle?.position).not.toBe('absolute');
    expect(footerStyle?.flexShrink).toBe('0');
  });
});
