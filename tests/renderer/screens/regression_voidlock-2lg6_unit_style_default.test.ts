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

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      drawImage: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
    });
  });

  it("should have 'Tactical Icons' as the default selection for unit style in wizard", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
        },
      } as any,
      onNodeSelect,
      onBack,
    );
    screen.show();

    const statusText = container.querySelector(".global-status-text");
    expect(statusText).not.toBeNull();
    expect(statusText?.textContent).toContain("TACTICALICONS");
  });
});
