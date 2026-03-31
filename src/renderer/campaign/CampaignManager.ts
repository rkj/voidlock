import { CampaignManager as EngineCampaignManager } from "@src/engine/campaign/CampaignManager";

/**
 * Re-export the Engine's CampaignManager.
 * In the renderer context, it is initialized with SaveManager.
 */
export { EngineCampaignManager as CampaignManager };


