import { CampaignManager as EngineCampaignManager } from "@src/engine/campaign/CampaignManager";
import { SaveManager } from "@src/services/SaveManager";

/**
 * Re-export the Engine's CampaignManager.
 * In the renderer context, it is initialized with SaveManager.
 */
export { EngineCampaignManager as CampaignManager };

// Initialize the singleton for the browser context
if (typeof window !== "undefined") {
  try {
    EngineCampaignManager.getInstance(new SaveManager());
  } catch (e) {
    // Already initialized or failed
  }
}
