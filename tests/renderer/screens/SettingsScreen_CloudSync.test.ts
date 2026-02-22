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

describe("SettingsScreen Cloud Sync", () => {
  let context: any;
  let screen: SettingsScreen;

  const defaultGlobalConfig = {
    unitStyle: "TacticalIcons",
    themeId: "default",
    logLevel: "INFO",
    debugSnapshots: false,
    debugSnapshotInterval: 0,
    debugOverlayEnabled: false,
    cloudSyncEnabled: true,
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-settings"></div>';
    
    context = {
      cloudSync: {
        isConfigured: vi.fn(),
        isSyncEnabled: vi.fn(),
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
        addChangeListener: vi.fn(),
        removeChangeListener: vi.fn(),
      },
      modalService: {
        confirm: vi.fn(),
        show: vi.fn(),
      },
    };

    (ConfigManager.loadGlobal as any).mockReturnValue({ ...defaultGlobalConfig });
  });

  const getSyncToggle = (): HTMLInputElement => {
    const labels = Array.from(document.querySelectorAll('label'));
    const syncLabel = labels.find(l => l.textContent?.includes("Enable Cloud Sync:"));
    return syncLabel?.nextElementSibling as HTMLInputElement;
  };

  it("should force toggle to unchecked and disabled when Firebase is not configured", () => {
    // GIVEN Firebase is not configured
    context.cloudSync.isConfigured.mockReturnValue(false);
    
    screen = new SettingsScreen(
      "screen-settings",
      context?.themeManager,
      context?.cloudSync,
      context?.modalService,
      vi.fn(),
    );
    screen.show();
    
    const body = document.body.innerHTML;
    // SHOULD show the specific error message
    expect(body).toContain("Cloud Sync Service Unavailable (Firebase not configured)");
    
    const syncToggle = getSyncToggle();
    expect(syncToggle).not.toBeNull();
    
    // SHOULD be disabled and unchecked
    expect(syncToggle.disabled).toBe(true);
    expect(syncToggle.checked).toBe(false);
    
    // AND the label should reflect the state
    const labels = Array.from(document.querySelectorAll('label'));
    const syncLabel = labels.find(l => l.textContent?.includes("Enable Cloud Sync:"));
    expect(syncLabel?.textContent).toContain("(Not Configured)");
  });

  it("should show 'Cloud Sync Service Unavailable' if cloudSync service is missing", () => {
    // GIVEN cloudSync service is missing
    context.cloudSync = null;
    
    screen = new SettingsScreen(
      "screen-settings",
      context?.themeManager,
      context?.cloudSync,
      context?.modalService,
      vi.fn(),
    );
    screen.show();
    
    const body = document.body.innerHTML;
    expect(body).toContain("Cloud Sync Service Unavailable");
    expect(body).not.toContain("(Firebase not configured)");
    
    const syncToggle = getSyncToggle();
    expect(syncToggle.disabled).toBe(true);
  });

  it("should allow toggling when Firebase is configured", () => {
    // GIVEN Firebase is configured
    context.cloudSync.isConfigured.mockReturnValue(true);
    (ConfigManager.loadGlobal as any).mockReturnValue({
      ...defaultGlobalConfig,
      cloudSyncEnabled: false,
    });
    
    screen = new SettingsScreen(
      "screen-settings",
      context?.themeManager,
      context?.cloudSync,
      context?.modalService,
      vi.fn(),
    );
    screen.show();
    
    const syncToggle = getSyncToggle();
    expect(syncToggle.disabled).toBe(false);
    expect(syncToggle.checked).toBe(false);
    
    // AND should NOT show the error message
    const body = document.body.innerHTML;
    expect(body).not.toContain("Cloud Sync Service Unavailable");
  });
});
