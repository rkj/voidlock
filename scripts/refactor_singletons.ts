import * as fs from "fs";

function replaceFile(path: string, replacer: (content: string) => string) {
  const content = fs.readFileSync(path, "utf-8");
  const updated = replacer(content);
  if (content !== updated) {
    fs.writeFileSync(path, updated, "utf-8");
    console.log(`Updated ${path}`);
  }
}

// 1. TooltipManager
replaceFile("src/renderer/ui/TooltipManager.ts", (c) => {
  return c
    .replace("private static instance: TooltipManager | undefined;", "")
    .replace("private constructor() {", "constructor() {")
    .replace("TooltipManager.instance = undefined;", "")
    .replace(/public static getInstance\(\): TooltipManager \{[\s\S]*?return TooltipManager.instance;\n  \}/, "");
});

// 2. AppServiceRegistry
replaceFile("src/renderer/app/AppServiceRegistry.ts", (c) => {
  let updated = c.replace(
    "public inputDispatcher!: InputDispatcher;",
    "public inputDispatcher!: InputDispatcher;\n  public tooltipManager!: TooltipManager;"
  );
  updated = updated.replace(
    "if (this.inputDispatcher) this.inputDispatcher.destroy();",
    "if (this.inputDispatcher) this.inputDispatcher.destroy();\n    if (this.tooltipManager) this.tooltipManager.destroy();"
  );
  updated = updated.replace(
    "this.modalService = new ModalService();",
    "this.tooltipManager = new TooltipManager();\n    this.modalService = new ModalService(this.inputDispatcher);"
  );
  updated = updated.replace(
    "import { InputDispatcher } from \"../InputDispatcher\";",
    "import { InputDispatcher } from \"../InputDispatcher\";\nimport { TooltipManager } from \"../ui/TooltipManager\";"
  );
  updated = updated.replace(
    "this.campaignManager = CampaignManager.getInstance(saveManager);",
    "this.campaignManager = new CampaignManager(saveManager, this.metaManager);"
  );
  updated = updated.replace(
    "this.metaManager = MetaManager.getInstance(new LocalStorageProvider());",
    "this.metaManager = new MetaManager(new LocalStorageProvider());"
  );
  return updated;
});

// 3. GameApp
replaceFile("src/renderer/app/GameApp.ts", (c) => {
  let updated = c.replace("TooltipManager.getInstance();\n", "");
  updated = updated.replace(
    "campaignManager: this.registry.campaignManager,",
    "campaignManager: this.registry.campaignManager,\n      metaManager: this.registry.metaManager,"
  );
  return updated;
});

// 4. ModalService
replaceFile("src/renderer/ui/ModalService.ts", (c) => {
  let updated = c.replace("constructor() {", "constructor(private inputDispatcher: InputDispatcher) {");
  updated = updated.replace(/InputDispatcher\.getInstance\(\)/g, "this.inputDispatcher");
  return updated;
});

// 5. InputDispatcher
replaceFile("src/renderer/InputDispatcher.ts", (c) => {
  let updated = c.replace("private static instance: InputDispatcher;", "");
  updated = updated.replace(/public static getInstance\(\): InputDispatcher \{[\s\S]*?return InputDispatcher\.instance;\n  \}/, "");
  return updated;
});

// 6. ThemeManager
replaceFile("src/renderer/ThemeManager.ts", (c) => {
  let updated = c.replace("private static instance: ThemeManager;", "");
  updated = updated.replace(/public static getInstance\(\): ThemeManager \{[\s\S]*?return ThemeManager\.instance;\n  \}/, "");
  return updated;
});

// 7. AssetManager
replaceFile("src/renderer/visuals/AssetManager.ts", (c) => {
  let updated = c.replace("private static instance: AssetManager;", "");
  updated = updated.replace(/public static getInstance\(\): AssetManager \{[\s\S]*?return AssetManager\.instance;\n  \}/, "");
  return updated;
});

// 8. MetaManager (Engine)
replaceFile("src/engine/campaign/MetaManager.ts", (c) => {
  let updated = c.replace("private static instance: MetaManager | null = null;", "");
  updated = updated.replace(/\/\*\*[\s\S]*?getInstance\(\)[\s\S]*?return MetaManager\.instance;\n  \}/, "");
  updated = updated.replace(/\/\*\*[\s\S]*?resetInstance\(\)[\s\S]*?MetaManager\.instance = null;\n  \}/, "");
  return updated;
});

// 9. CampaignManager (Engine)
replaceFile("src/engine/campaign/CampaignManager.ts", (c) => {
  let updated = c.replace("private static instance: CampaignManager | null = null;", "private metaManager: MetaManager;");
  updated = updated.replace("private constructor(storage: StorageProvider) {", "public constructor(storage: StorageProvider, metaManager: MetaManager) {\n    this.metaManager = metaManager;");
  updated = updated.replace(/public static getInstance[\s\S]*?return CampaignManager\.instance;\n  \}/, "");
  updated = updated.replace(/public static resetInstance\(\): void \{\n    CampaignManager\.instance = null;\n  \}\n\n  public static resetSingleton\(\): void \{\n    CampaignManager\.instance = null;\n  \}/, "");
  updated = updated.replace(/MetaManager\.getInstance\(this\.storage\)/g, "this.metaManager");
  return updated;
});

// 10. MetaManager (Renderer)
replaceFile("src/renderer/campaign/MetaManager.ts", (c) => {
  let updated = c.replace(/\/\/ Initialize the singleton[\s\S]*?\}\n\}/, "");
  return updated;
});

// 11. CampaignManager (Renderer)
replaceFile("src/renderer/campaign/CampaignManager.ts", (c) => {
  let updated = c.replace(/\/\/ Initialize the singleton[\s\S]*?\}\n\}/, "");
  return updated;
});

// 12. NewCampaignWizard
replaceFile("src/renderer/screens/campaign/NewCampaignWizard.ts", (c) => {
  let updated = c.replace("import { MetaManager } from \"@src/renderer/campaign/MetaManager\";", "import type { MetaStats } from \"@src/shared/campaign_types\";");
  updated = updated.replace("onBack: () => void;", "onBack: () => void;\n  metaStats: MetaStats;");
  updated = updated.replace("const metaStats = MetaManager.getInstance().getStats();", "const metaStats = this.options.metaStats;");
  return updated;
});

// 13. CampaignScreen
replaceFile("src/renderer/screens/CampaignScreen.ts", (c) => {
  let updated = c.replace("campaignManager: CampaignManager;", "campaignManager: CampaignManager;\n  metaManager: import(\"@src/renderer/campaign/MetaManager\").MetaManager;");
  updated = updated.replace("private manager: CampaignManager;", "private manager: CampaignManager;\n  private metaManager: import(\"@src/renderer/campaign/MetaManager\").MetaManager;");
  updated = updated.replace("themeManager,\n      inputDispatcher,", "metaManager,\n      themeManager,\n      inputDispatcher,");
  updated = updated.replace("this.manager = campaignManager;", "this.manager = campaignManager;\n    this.metaManager = metaManager;");
  updated = updated.replace("this.wizard = new NewCampaignWizard(this.container, {", "this.wizard = new NewCampaignWizard(this.container, {\n      metaStats: this.metaManager.getStats(),");
  return updated;
});

