import * as fs from "fs";
import { execSync } from "child_process";

function replaceInFile(path: string, replacer: (content: string) => string) {
  try {
    const content = fs.readFileSync(path, "utf-8");
    const updated = replacer(content);
    if (content !== updated) {
      fs.writeFileSync(path, updated, "utf-8");
    }
  } catch (e) {
    // Ignore missing files
  }
}

// 1. Fix test instantiations of managers
const findTestFiles = () => {
    return execSync('find tests -name "*.ts"').toString().split('\n').filter(Boolean);
}

const testFiles = findTestFiles();
for (const file of testFiles) {
    replaceInFile(file, (c) => {
        let updated = c;

        // Fix MetaManager
        updated = updated.replace(/MetaManager\.resetInstance\(\);?/g, "");
        updated = updated.replace(/MetaManager\.getInstance\((.*?)\)/g, "new MetaManager($1)");
        updated = updated.replace(/\(MetaManager as any\)\.instance = null;?/g, "");

        // Fix CampaignManager
        updated = updated.replace(/CampaignManager\.resetInstance\(\);?/g, "");
        updated = updated.replace(/CampaignManager\.resetSingleton\(\);?/g, "");
        updated = updated.replace(/\(CampaignManager as any\)\.instance = null;?/g, "");
        updated = updated.replace(/CampaignManager\.getInstance\((.*?)\)/g, "new CampaignManager($1, new MetaManager(new MockStorageProvider()))");

        // Fix TooltipManager
        updated = updated.replace(/TooltipManager\.getInstance\(\)/g, "new TooltipManager()");

        // Fix NewCampaignWizard test instantiations
        updated = updated.replace(/new NewCampaignWizard\((\s*.*?), \{\s*onStartCampaign/g, "new NewCampaignWizard($1, {\n      metaStats: { prologueCompleted: false } as any,\n      onStartCampaign");

        return updated;
    });
}
console.log("Test fixes applied.");
