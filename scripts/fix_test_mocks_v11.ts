import * as fs from 'fs';
import * as path from 'path';

const filesToFix = [
    'tests/renderer/integration/E2E_CampaignLoss.test.ts',
    'tests/renderer/integration/FullCampaignFlow.test.ts',
    'tests/renderer/integration/UserJourneys.test.ts'
];

for (const filePath of filesToFix) {
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = content;
    
    // Replace new CampaignManager(...) with app.registry.campaignManager
    updated = updated.replace(/const cm = new CampaignManager\([^)]+\);/g, 'const cm = app.registry.campaignManager;');
    updated = updated.replace(/const cm = new CampaignManager\([^)]+\)/g, 'const cm = app.registry.campaignManager');
    updated = updated.replace(/cm = new CampaignManager\([^)]+\);/g, 'cm = app.registry.campaignManager;');
    
    // Also handle cases where it's assigned to a variable named differently
    updated = updated.replace(/this\.cm = new CampaignManager\([^)]+\);/g, 'this.cm = app.registry.campaignManager;');
    
    // Specific fix for FullCampaignFlow.test.ts
    updated = updated.replace(/app\.registry\.campaignManager\.reset\(\);/g, 'app.registry.campaignManager.reset();');
    // Ensure we don't have broken new CampaignManager in beforeEach
    updated = updated.replace(/new CampaignManager\(new MockStorageProvider\(\), new MetaManager\(new MockStorageProvider\(\)\)\);/g, '// CampaignManager now handled by GameApp');

    if (updated !== content) {
      console.log('Polishing v11 (revised) ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
}
