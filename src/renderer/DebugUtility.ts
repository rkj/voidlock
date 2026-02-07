import { GameState, ReplayData } from "@src/shared/types";
import { ModalService } from "./ui/ModalService";
import { Logger } from "@src/shared/Logger";

/**
 * Utility for debug-related actions.
 */
export class DebugUtility {
  /**
   * Captures the world state and attempts to copy it to the clipboard.
   * Falls back to console.log if the Clipboard API is unavailable.
   */
  public static async copyWorldState(
    state: GameState,
    replayData: ReplayData | null,
    version: string,
    modalService: ModalService,
  ): Promise<void> {
    if (!state) return;

    const mapGenerator =
      state.map?.generatorName || replayData?.map?.generatorName || "Unknown";

    const fullState = {
      replayData,
      currentState: state,
      mapGenerator,
      version: version,
      timestamp: Date.now(),
    };

    const json = JSON.stringify(fullState, null, 2);

    // Check if navigator.clipboard is available
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      try {
        await navigator.clipboard.writeText(json);
        await modalService.alert("World State copied to clipboard!");
      } catch (err) {
        await this.handleCopyFallback(json, err, modalService);
      }
    } else {
      await this.handleCopyFallback(
        json,
        new Error("Clipboard API unavailable"),
        modalService,
      );
    }
  }

  private static async handleCopyFallback(
    json: string,
    error: unknown,
    modalService: ModalService,
  ): Promise<void> {
    Logger.error("Failed to copy state to clipboard:", error);
    Logger.info("Full World State JSON:");
    Logger.info(json);
    await modalService.alert(
      "Failed to copy to clipboard. See console for JSON.",
    );
  }
}
