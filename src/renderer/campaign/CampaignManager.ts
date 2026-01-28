import { CampaignManager as EngineCampaignManager } from "@src/engine/campaign/CampaignManager";
import { LocalStorageProvider } from "@src/engine/persistence/LocalStorageProvider";

/**
 * Re-export the Engine's CampaignManager.
 * In the renderer context, it is initialized with LocalStorageProvider.
 */
export { EngineCampaignManager as CampaignManager };

// Initialize the singleton for the browser context
if (typeof window !== "undefined") {
  try {
    EngineCampaignManager.getInstance(new LocalStorageProvider());
  } catch (e) {
    // Already initialized or failed
  }
}
