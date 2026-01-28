import { MetaManager as EngineMetaManager } from "@src/engine/campaign/MetaManager";
import { LocalStorageProvider } from "@src/engine/persistence/LocalStorageProvider";

/**
 * Re-export the Engine's MetaManager.
 * In the renderer context, it is initialized with LocalStorageProvider.
 */
export { EngineMetaManager as MetaManager };

// Initialize the singleton for the browser context
if (typeof window !== "undefined") {
  try {
    EngineMetaManager.getInstance(new LocalStorageProvider());
  } catch (e) {
    // Already initialized or failed
  }
}
