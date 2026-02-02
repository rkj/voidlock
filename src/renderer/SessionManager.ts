import { ScreenId } from "@src/renderer/ScreenManager";

export class SessionManager {
  private static readonly STORAGE_KEY = "voidlock_session_state";

  public saveState(screenId: ScreenId, isCampaign: boolean = false): void {
    localStorage.setItem(
      SessionManager.STORAGE_KEY,
      JSON.stringify({ screenId, isCampaign }),
    );
  }

  public loadState(): { screenId: ScreenId; isCampaign: boolean } | null {
    const data = localStorage.getItem(SessionManager.STORAGE_KEY);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      return {
        screenId: parsed.screenId || null,
        isCampaign: !!parsed.isCampaign,
      };
    } catch (e) {
      console.error("Failed to parse session state", e);
      return null;
    }
  }

  public clearState(): void {
    localStorage.removeItem(SessionManager.STORAGE_KEY);
  }
}
