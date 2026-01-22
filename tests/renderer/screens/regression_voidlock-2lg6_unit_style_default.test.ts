// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

describe("CampaignScreen Unit Style Default Regression", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onNodeSelect: any;
  let onBack: any;
  let mockModalService: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-campaign"></div>';
    container = document.getElementById("screen-campaign")!;

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(
      new (class {
        save() {}
        load() {
          return null;
        }
        remove() {}
        clear() {}
      })(),
    );
    onNodeSelect = vi.fn();
    onBack = vi.fn();
    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
    };
  });

  it("should have 'Tactical Icons' as the default selection for unit style in wizard", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      mockModalService,
      onNodeSelect,
      onBack,
    );
    screen.show();

    const styleSelect = container.querySelector(
      "#campaign-unit-style",
    ) as HTMLSelectElement;
    expect(styleSelect).not.toBeNull();
    expect(styleSelect.value).toBe("TacticalIcons");
    expect(styleSelect.options[styleSelect.selectedIndex].text).toContain(
      "Tactical Icons",
    );
  });
});
