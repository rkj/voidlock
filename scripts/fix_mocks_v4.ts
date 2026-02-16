import fs from 'fs';
import path from 'path';

const files = [
  'tests/renderer/integration/CampaignEnd.test.ts',
  'tests/renderer/integration/CampaignFlow_NoSetup.test.ts',
  'tests/renderer/integration/CampaignMapGenerator.test.ts',
  'tests/renderer/integration/E2E_CampaignLoss.test.ts',
  'tests/renderer/integration/E2E_CampaignWin.test.ts',
  'tests/renderer/integration/EquipmentPersistence.test.ts',
  'tests/renderer/integration/FullCampaignFlow.test.ts',
  'tests/renderer/integration/MissionSetupContextHeader.test.ts',
  'tests/renderer/integration/NonCombatNodes.test.ts',
  'tests/renderer/integration/regression_voidlock_14fv_campaign_reload.test.ts',
  'tests/renderer/integration/regression_voidlock_4eeb_loot_spawning.test.ts',
  'tests/renderer/integration/regression_voidlock_awkx_setup_shell.test.ts',
  'tests/renderer/integration/regression_voidlock_hzc9_equipment_back.test.ts',
  'tests/renderer/integration/regression_voidlock_tbuh_shell_visibility.test.ts',
  'tests/renderer/integration/regression_voidlock_vwhe_sticky_footer.test.ts',
  'tests/renderer/integration/ReplayButtonFlow.test.ts',
  'tests/renderer/integration/ReplayLoading.test.ts',
  'tests/renderer/integration/ScreenFlow.test.ts',
  'tests/renderer/integration/UserJourneys.test.ts',
  'tests/renderer/repro/debrief_replay_stop.test.ts',
  'tests/renderer/repro/EndCustomMissionRepro.test.ts',
  'tests/renderer/repro/GameApp_MapGenerator.test.ts',
  'tests/renderer/repro/regression_voidlock_hzc9_equipment_back.test.ts',
  'tests/renderer/screens/DebriefScreen_Replay.test.ts',
  'tests/renderer/screens/DebriefScreen.test.ts',
  'tests/renderer/screens/DebriefScreen_Visual.test.ts',
  'tests/renderer/screens/regression_voidlock_pzzz_replay_speed.test.ts',
  'tests/renderer/ui/regression_voidlock_t484_top_bar_consistency.test.ts',
  'tests/renderer/screens/regression_voidlock_1owo_equipment_cost.test.ts',
  'tests/renderer/screens/regression_voidlock_5zjs_scrap_display.test.ts'
];

files.forEach(file => {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping missing file: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Update GameClient mock
  if (content.includes('getTargetScale:') && !content.includes('getTimeScale:')) {
    content = content.replace(
      /(getTargetScale:.*?,)/,
      `$1
  getTimeScale: vi.fn().mockReturnValue(1.0),`
    );
    changed = true;
  }

  // 2. Update CampaignManager mock (common patterns)
  if (content.includes('getState:') && !content.includes('getSyncStatus:')) {
    // Handle cases where CampaignManager is mocked via vi.mock
    content = content.replace(
      /(getState:.*?,)/,
      `$1
        getStorage: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),`
    );
    changed = true;
  }

  // 3. Special case for regression_voidlock_t484_top_bar_consistency.test.ts and others where manager is an object literal
  if (file.includes('t484') || file.includes('1owo') || file.includes('5zjs')) {
      if (content.includes('manager = {') || content.includes('mockManager = {')) {
          if (!content.includes('getSyncStatus:')) {
              content = content.replace(
                  /(getState:.*?,)/,
                  `$1
      getSyncStatus: vi.fn().mockReturnValue("local-only"),`
              );
              changed = true;
          }
      }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
