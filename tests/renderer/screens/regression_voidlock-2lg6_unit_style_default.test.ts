// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { InputDispatcher } from "@src/renderer/InputDispatcher";
import { setLocale } from "@src/renderer/i18n";

describe("CampaignScreen Unit Style Default Regression", () => {
  let manager: CampaignManager;
  let themeManager: any;
  let inputDispatcher: any;
  let onNodeSelect: any;
  let onBack: any;
  let container: HTMLDivElement;
  let mockModalService: any;

  beforeEach(() => {
    setLocale("en-standard");
    document.body.innerHTML = '<div id="screen-campaign"></div>';
    container = document.getElementById("screen-campaign") as HTMLDivElement;

    // Mock window.ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    manager = new CampaignManager(
      new MockStorageProvider(),
      new MetaManager(new MockStorageProvider())
    );
    onNodeSelect = vi.fn();
    onBack = vi.fn();
    themeManager = {
      getAssetUrl: vi.fn().mockReturnValue("test.png"),
    };
    inputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
    mockModalService = {
      show: vi.fn(),
    };
  });

  it("should have 'Tactical Icons' as the default selection for unit style in wizard", () => {
    const metaManager = new MetaManager(new MockStorageProvider());
    const screen = new CampaignScreen({
      containerId: "screen-campaign",
      campaignManager: manager,
      metaManager: metaManager,
      themeManager: themeManager as any,
      inputDispatcher: inputDispatcher as any,
      modalService: mockModalService as any,
      onNodeSelect,
      onBack,
      onMainMenu: vi.fn(),
    });

    // In the new CampaignScreen, if there's no campaign, show() will render the wizard immediately.
    screen.show();

    // Wait for wizard to render
    const wizard = document.querySelector(".wizard-content");
    expect(wizard).not.toBeNull();

    // Check status text for default settings
    const statusText = container.querySelector(".global-status-text");
    expect(statusText).not.toBeNull();
    // In en-standard, TacticalIcons is "Tactical Icons"
    expect(statusText?.textContent).toContain("Tactical Icons");
  });
});
