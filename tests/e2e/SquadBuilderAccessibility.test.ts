import { test, expect } from '@playwright/test';
import { E2E_URL } from './config';
import { loadAndSnapshot } from './utils/puppeteer';

test('Remove button is skipped in tab order', async ({ page }) => {
  await page.goto(E2E_URL + '#mission-setup');
  await page.evaluate((state) => {
    localStorage.setItem('voidlock_campaign_v1', JSON.stringify(state));
    localStorage.setItem('voidlock_global_config', JSON.stringify({
      unitStyle: 'TacticalIcons',
      themeId: 'default',
      logLevel: 'INFO',
      debugSnapshots: false,
      debugSnapshotInterval: 0,
      debugOverlayEnabled: false,
      cloudSyncEnabled: false
    }));
  }, {
    campaignName: 'Test Campaign',
    rules: {
      deathRule: 'Iron',
      allowTacticalPause: true
    },
    roster: [
      {
        id: 'soldier-1',
        name: 'Soldier 1',
        archetypeId: 'soldier_scout',
        hp: 100,
        maxHp: 100,
        soldierAim: 75,
        equipment: {
          rightHand: 'knife',
          leftHand: 'pistol',
          body: 'armor_vest',
          feet: 'boots'
        },
        status: 'Healthy'
      }
    ],
    missionNumber: 1,
    sector: 1,
    scrap: 500,
    intelGained: 0,
    rulesVersion: 1,
    unlockedArchetypes: ['soldier_scout'],
    globalStats: {
      missionsStarted: 0,
      missionsWon: 0,
      missionsLost: 0,
      totalKills: 0,
      totalScrap: 0
    }
  });
  await page.goto(E2E_URL + '#mission-setup');

  // Focus on the first soldier card
  await page.focus('.soldier-widget[tabindex="0"]');
  
  //Press Tab twice to attempt to reach the remove button
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  const activeElement = await page.evaluate(() => document.activeElement.className);
  
  // Expect that the active element IS the remove button
  expect(activeElement).toBe('slot-remove');
});