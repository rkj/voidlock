import fs from 'fs';
import path from 'path';

// All test files identified from grep plus failures
const testFiles = [
  'tests/renderer/SquadBuilder.test.ts',
  'tests/renderer/regression_voidlock-94kf_custom_soldier_names.test.ts',
  'tests/renderer/regression_voidlock_qahx_visual_style_visibility.test.ts',
  'tests/renderer/regression_ii5f_unit_style_visibility.test.ts',
  'tests/renderer/regression_voidlock-dp5x_quick_revive.test.ts',
  'tests/renderer/regression_voidlock_33sa_click_place.test.ts',
  'tests/renderer/repro_voidlock_82zwg_seed_overwrite.test.ts',
  'tests/renderer/regression_voidlock_nrdb_vip_slot.test.ts',
  'tests/renderer/integration/CampaignEnd.test.ts',
  'tests/renderer/integration/regression_voidlock_vwhe_sticky_footer.test.ts',
  'tests/renderer/integration/CampaignMapGenerator.test.ts',
  'tests/renderer/integration/EquipmentPersistence.test.ts',
  'tests/renderer/integration/ReplayButtonFlow.test.ts',
  'tests/renderer/integration/regression_voidlock_awkx_setup_shell.test.ts',
  'tests/renderer/integration/regression_voidlock_hzc9_equipment_back.test.ts',
  'tests/renderer/integration/regression_voidlock_14fv_campaign_reload.test.ts',
  'tests/renderer/integration/UserJourneys.test.ts',
  'tests/renderer/integration/ScreenFlow.test.ts',
  'tests/renderer/integration/ScrapUpdate.test.ts',
  'tests/renderer/integration/CampaignFlow_NoSetup.test.ts',
  'tests/renderer/integration/regression_voidlock_tbuh_shell_visibility.test.ts',
  'tests/renderer/integration/MissionSetupContextHeader.test.ts',
  'tests/renderer/regression_voidlock_uk61_enemy_tracers.test.ts',
  'tests/renderer/regression_voidlock_5uef_auto_deploy.test.ts',
  'tests/renderer/regression_voidlock_g72o_style_preview.test.ts',
  'tests/renderer/repro/regression_voidlock_hzc9_equipment_back.test.ts',
  'tests/renderer/repro/SquadBuilderMove.test.ts',
  'tests/renderer/screens/SettingsScreen.test.ts',
  'tests/renderer/screens/SettingsScreen_CloudSync.test.ts',
  'tests/renderer/screens/EquipmentScreen.test.ts',
  'tests/renderer/screens/EquipmentScreen.stats.test.ts',
  'tests/renderer/screens/SquadManagement_Refactor.test.ts',
  'tests/renderer/screens/regression_6k8w_supply_prices.test.ts',
  'tests/renderer/screens/regression_focus_loss.test.ts',
  'tests/renderer/screens/regression_rfw4_consumable_cap.test.ts',
  'tests/renderer/screens/regression_voidlock-9xr6_price_formatting.test.ts',
  'tests/renderer/screens/regression_voidlock-9xr6_scroll_reset.test.ts',
  'tests/renderer/screens/regression_voidlock-n8aq_dead_soldier_equipment.test.ts',
  'tests/renderer/screens/regression_voidlock_1owo_equipment_cost.test.ts',
  'tests/renderer/screens/regression_voidlock_5zjs_scrap_display.test.ts',
  'tests/renderer/ui/CampaignShell.test.ts',
  'tests/renderer/ui/CampaignShell_CustomTabs.test.ts',
  'tests/renderer/ui/regression_voidlock_t484_top_bar_consistency.test.ts'
];

testFiles.forEach(file => {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping missing file: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Pattern 1: Inside a vi.mock block or object literal
  // Look for getState: and add listeners if missing
  if (content.includes('getState') && !content.includes('addChangeListener')) {
    content = content.replace(
      /(getState:.*?,)/,
      `$1
        addChangeListener: vi.fn(),
        removeChangeListener: vi.fn(),`
    );
    changed = true;
  }

  // Pattern 2: campaignManager: { ... } or mockManager = { ... }
  // (Pattern 1 should cover this if they have getState)

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
