/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsScreen } from "@src/renderer/screens/SettingsScreen";
import { ConfigManager } from "@src/renderer/ConfigManager";

// Mock dependencies
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn(),
    saveGlobal: vi.fn(),
  },
}));

vi.mock("@src/services/firebase", () => ({
  isFirebaseConfigured: false,
  db: {},
  auth: {},
}));

describe("SettingsScreen", () => {
  let context: any;
  let screen: SettingsScreen;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-settings"></div>';
    
    context = {
      cloudSync: {
        isConfigured: vi.fn().mockReturnValue(false),
        isSyncEnabled: vi.fn().mockReturnValue(false),
        getUser: vi.fn().mockReturnValue(null),
        isAnonymous: vi.fn().mockReturnValue(true),
        setEnabled: vi.fn(),
        initialize: vi.fn().mockResolvedValue(undefined),
      },
      screenManager: {
        goBack: vi.fn(),
        getCurrentScreen: vi.fn().mockReturnValue("settings"),
      },
      campaignManager: {
        getState: vi.fn().mockReturnValue(null),
      },
      modalService: {
        confirm: vi.fn(),
        show: vi.fn(),
      },
    };

    (ConfigManager.loadGlobal as any).mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      logLevel: "INFO",
      debugSnapshots: false,
      debugSnapshotInterval: 0,
      debugOverlayEnabled: false,
      cloudSyncEnabled: true, // Enabled but not configured
    });

    screen = new SettingsScreen(
      "screen-settings",
      context.themeManager,
      context.cloudSync,
      context.modalService,
      vi.fn(),
    );
  });

  it("should show error message and have toggle enabled when cloudSyncEnabled is true but not configured", () => {
    screen.show();
    
    const body = document.body.innerHTML;
    expect(body).toContain("Cloud Sync Service Unavailable (Firebase not configured)");
    
    const labels = Array.from(document.querySelectorAll('label'));
    const syncLabel = labels.find(l => l.textContent?.includes("Enable Cloud Sync:"));
    expect(syncLabel).not.toBeNull();
    
    const syncToggle = syncLabel?.nextElementSibling as HTMLInputElement;
    expect(syncToggle).not.toBeNull();
    expect(syncToggle.type).toBe("checkbox");
    
    // Fix confirmed: toggle should be disabled and unchecked if not configured
    expect(syncToggle.disabled).toBe(true);
    expect(syncToggle.checked).toBe(false);
    expect(syncLabel?.textContent).toContain("(Not Configured)");
  });
});
