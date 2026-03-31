import { MetaManager as EngineMetaManager } from "@src/engine/campaign/MetaManager";

/**
 * Re-export the Engine's MetaManager.
 * In the renderer context, it is initialized with LocalStorageProvider.
 */
export { EngineMetaManager as MetaManager };


