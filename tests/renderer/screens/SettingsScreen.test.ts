import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsScreen } from "@src/renderer/screens/SettingsScreen";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("SettingsScreen", () => {
  let container: HTMLElement;
  let screen: SettingsScreen;
  let mockInputDispatcher: any;
  let mockThemeManager: any;
  let mockAssetManager: any;
  let mockCloudSync: any;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "screen-settings";
    document.body.appendChild(container);

    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };

    mockThemeManager = {
      getAssetUrl: vi.fn(),
      setTheme: vi.fn(),
      setPhosphorMode: vi.fn(),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
      getCurrentPhosphorMode: vi.fn().mockReturnValue("green"),
    };

    mockAssetManager = {
      loadSprites: vi.fn(),
      getUnitSprite: vi.fn(),
      getEnemySprite: vi.fn(),
      getMiscSprite: vi.fn(),
    };

    mockCloudSync = {
      initialize: vi.fn().mockResolvedValue(undefined),
      setEnabled: vi.fn(),
      isEnabled: vi.fn().mockReturnValue(false),
      isConfigured: vi.fn().mockReturnValue(true),
      getAuth: vi.fn().mockReturnValue({
        onAuthStateChanged: vi.fn().mockReturnValue(() => {}),
        currentUser: null,
      }),
    };

    vi.mock("@src/renderer/ConfigManager", () => ({
      ConfigManager: {
        loadGlobal: vi.fn().mockReturnValue({
          unitStyle: "TacticalIcons",
          themeId: "default",
          phosphorMode: "green",
          logLevel: "INFO",
          debugSnapshots: false,
          debugSnapshotInterval: 500,
          debugOverlay: false,
          locale: "en-corporate",
        }),
        saveGlobal: vi.fn(),
      },
    }));

    screen = new SettingsScreen({
      containerId: "screen-settings",
      inputDispatcher: mockInputDispatcher,
      themeManager: mockThemeManager,
      assetManager: mockAssetManager,
      cloudSync: mockCloudSync,
      onBack: vi.fn(),
      onLocaleChange: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it("should show error message and have toggle disabled when Firebase is not configured", () => {
    mockCloudSync.isConfigured.mockReturnValue(false);
    screen.show();

    const body = document.body.innerHTML;
    expect(body).toContain(t(I18nKeys.screen.settings.sync_unavailable_firebase));
    
    const syncToggle = container.querySelector('input[type="checkbox"]:disabled') as HTMLInputElement;
    expect(syncToggle).not.toBeNull();
  });

  it("should render locale selector and trigger onLocaleChange when changed", () => {
    const onLocaleChange = vi.fn();
    screen = new SettingsScreen({
      containerId: "screen-settings",
      inputDispatcher: mockInputDispatcher,
      themeManager: mockThemeManager,
      assetManager: mockAssetManager,
      cloudSync: mockCloudSync,
      onBack: vi.fn(),
      onLocaleChange,
    });

    screen.show();

    const langSelect = container.querySelector("#settings-language") as HTMLSelectElement;
    expect(langSelect).not.toBeNull();
    expect(langSelect.value).toBe("en-corporate");

    langSelect.value = "pl";
    langSelect.dispatchEvent(new Event("change"));

    expect(onLocaleChange).toHaveBeenCalled();
  });
});
