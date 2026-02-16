import fs from 'fs';
import path from 'path';

const filesToUpdateGameClient = [
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
  'tests/renderer/screens/regression_voidlock_pzzz_replay_speed.test.ts'
];

const filesToUpdateCampaignManager = [
  'tests/renderer/repro/regression_voidlock_hzc9_equipment_back.test.ts',
  'tests/renderer/regression_voidlock_g72o_style_preview.test.ts',
  'tests/renderer/integration/MissionSetupContextHeader.test.ts',
  'tests/renderer/integration/CampaignFlow_NoSetup.test.ts',
  'tests/renderer/integration/CampaignEnd.test.ts',
  'tests/renderer/integration/regression_voidlock_tbuh_shell_visibility.test.ts',
  'tests/renderer/integration/ScreenFlow.test.ts',
  'tests/renderer/integration/regression_voidlock_14fv_campaign_reload.test.ts',
  'tests/renderer/integration/UserJourneys.test.ts',
  'tests/renderer/integration/regression_voidlock_hzc9_equipment_back.test.ts',
  'tests/renderer/integration/ReplayButtonFlow.test.ts',
  'tests/renderer/integration/EquipmentPersistence.test.ts',
  'tests/renderer/integration/CampaignMapGenerator.test.ts',
  'tests/renderer/integration/regression_voidlock_vwhe_sticky_footer.test.ts',
  'tests/renderer/integration/regression_voidlock_awkx_setup_shell.test.ts'
];

const filesMissingGetSyncStatusInComponentMocks = [
  'tests/renderer/ui/regression_voidlock_t484_top_bar_consistency.test.ts',
  'tests/renderer/screens/regression_voidlock_1owo_equipment_cost.test.ts',
  'tests/renderer/screens/regression_voidlock_5zjs_scrap_display.test.ts'
];

function updateFile(filePath, updates) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const update of updates) {
    if (content.includes(update.old) && !content.includes(update.new)) {
      content = content.replace(update.old, update.new);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  }
}

// Update GameClient mocks
for (const file of filesToUpdateGameClient) {
  updateFile(file, [
    {
      old: 'getTargetScale: vi.fn().mockReturnValue(1.0),',
      new: 'getTargetScale: vi.fn().mockReturnValue(1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),'
    }
  ]);
}

// Update CampaignManager mocks
for (const file of filesToUpdateCampaignManager) {
  updateFile(file, [
    {
      old: 'getState: vi.fn(() => currentCampaignState),',
      new: 'getState: vi.fn(() => currentCampaignState),
        getStorage: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),'
    },
    {
      old: 'getState: vi.fn().mockReturnValue(mockCampaignState),',
      new: 'getState: vi.fn().mockReturnValue(mockCampaignState),
        getStorage: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),'
    },
    {
      old: 'getState: vi.fn().mockReturnValue(null),',
      new: 'getState: vi.fn().mockReturnValue(null),
        getStorage: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),'
    }
  ]);
}

// Update specific component mocks
for (const file of filesMissingGetSyncStatusInComponentMocks) {
    updateFile(file, [
        {
            old: 'getState: vi.fn(() => ({',
            new: 'getSyncStatus: vi.fn().mockReturnValue("local-only"),
      getState: vi.fn(() => ({'
        },
        {
            old: 'getState: vi.fn().mockReturnValue({',
            new: 'getSyncStatus: vi.fn().mockReturnValue("local-only"),
      getState: vi.fn().mockReturnValue({'
        }
    ]);
}
