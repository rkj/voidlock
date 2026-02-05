import fs from 'fs';
import path from 'fs';

const files = [
  'tests/renderer/regression_voidlock-l5qf_reset_data.test.ts',
  'tests/renderer/repro/EndCustomMissionRepro.test.ts',
  'tests/renderer/repro/regression_voidlock_hzc9_equipment_back.test.ts',
  'tests/renderer/repro/GameApp_MapGenerator.test.ts',
  'tests/renderer/regression_voidlock-dp5x_quick_revive.test.ts',
  'tests/renderer/integration/regression_voidlock_tbuh_shell_visibility.test.ts',
  'tests/renderer/integration/MissionSetupContextHeader.test.ts',
  'tests/renderer/integration/CampaignMapGenerator.test.ts',
  'tests/renderer/integration/E2E_CampaignLoss.test.ts',
  'tests/renderer/integration/CampaignEnd.test.ts',
  'tests/renderer/integration/regression_kj08_abort_persistence.test.ts',
  'tests/renderer/integration/regression_voidlock_awkx_setup_shell.test.ts',
  'tests/renderer/integration/regression_voidlock_hzc9_equipment_back.test.ts',
  'tests/renderer/integration/regression_voidlock_14fv_campaign_reload.test.ts',
  'tests/renderer/integration/E2E_CampaignWin.test.ts',
  'tests/renderer/integration/regression_voidlock_4eeb_loot_spawning.test.ts',
  'tests/renderer/integration/FullCampaignFlow.test.ts',
  'tests/renderer/integration/EquipmentPersistence.test.ts',
  'tests/renderer/integration/NonCombatNodes.test.ts',
  'tests/renderer/integration/ScreenFlow.test.ts',
  'tests/renderer/integration/regression_voidlock_vwhe_sticky_footer.test.ts',
  'tests/renderer/integration/ReplayButtonFlow.test.ts'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Pattern 1: simple mock
    content = content.replace(
      /init: vi\.fn\(\)\.mockResolvedValue\(undefined\),\s*setTheme: vi\.fn\(\),?\s*\}/g,
      'init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
      getAssetUrl: vi.fn().mockReturnValue(""),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
    }'
    );
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
