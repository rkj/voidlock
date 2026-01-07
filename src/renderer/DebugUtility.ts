import { GameState } from "../shared/types";

/**
 * Utility for debug-related actions.
 */
export class DebugUtility {
  /**
   * Captures the world state and attempts to copy it to the clipboard.
   * Falls back to console.log if the Clipboard API is unavailable.
   */
  public static copyWorldState(
    state: GameState,
    replayData: any,
    version: string,
  ): void {
    if (!state) return;

    const fullState = {
      replayData,
      currentState: state,
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
        navigator.clipboard
          .writeText(json)
          .then(() => {
            alert("World State copied to clipboard!");
          })
          .catch((err) => {
            this.handleCopyFallback(json, err);
          });
      } catch (err) {
        this.handleCopyFallback(json, err);
      }
    } else {
      this.handleCopyFallback(json, new Error("Clipboard API unavailable"));
    }
  }

  private static handleCopyFallback(json: string, error: any): void {
    console.error("Failed to copy state to clipboard:", error);
    console.log("Full World State JSON:");
    console.log(json);
    alert("Failed to copy to clipboard. See console for JSON.");
  }
}
