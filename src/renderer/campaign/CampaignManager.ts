import { CampaignManager as EngineCampaignManager } from "@src/engine/campaign/CampaignManager";
import { SaveManager } from "@src/services/SaveManager";
import { ConfigManager } from "../ConfigManager";

/**
 * Re-export the Engine's CampaignManager.
 * In the renderer context, it is initialized with SaveManager.
 */
export { EngineCampaignManager as CampaignManager };

// Initialize the singleton for the browser context
if (typeof window !== "undefined") {
  try {
    const globalConfig = ConfigManager.loadGlobal();
    const saveManager = new SaveManager();
    saveManager.getCloudSync().setEnabled(globalConfig.cloudSyncEnabled);
    EngineCampaignManager.getInstance(saveManager);
  } catch (e) {
    // Already initialized or failed
  }
}
