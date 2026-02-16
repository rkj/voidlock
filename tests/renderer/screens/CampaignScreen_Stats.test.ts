/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { ModalService } from "@src/renderer/ui/ModalService";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignScreen - Global Stats", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let modalService: ModalService;
  let screen: CampaignScreen;
  let storage: MockStorageProvider;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.createElement("div");
    container.id = "screen-campaign";
    document.getElementById("app")?.appendChild(container);

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    storage = new MockStorageProvider();
    MetaManager.resetInstance();
    MetaManager.getInstance(storage);

    // Initialize stats
    const meta = MetaManager.getInstance();
    meta.recordCampaignStarted();
    meta.recordMissionResult(10, 2, true, 100);

    manager = CampaignManager.getInstance(storage);
    modalService = new ModalService();

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
      setLineDash: vi.fn(),
    });

    screen = new CampaignScreen(
      "screen-campaign",
      manager,
      modalService,
      vi.fn(),
      vi.fn(),
    );
  });

  it("should NOT render global stats in the campaign map (responsibility moved to shell)", () => {
    vi.spyOn(manager, "getState").mockReturnValue({
      status: "Active",
      nodes: [],
      rules: { difficulty: "normal" },
      history: [],
    } as any);

    screen.show();

    const footer = container.querySelector(".campaign-footer");
    expect(footer).toBeNull();
  });

  it("should NOT render global stats in the victory screen (responsibility moved to shell)", () => {
    vi.spyOn(manager, "getState").mockReturnValue({
      status: "Victory",
      nodes: [],
      rules: { difficulty: "normal" },
      history: [],
    } as any);

    screen.show();

    const footer = container.querySelector(".campaign-footer");
    expect(footer).toBeNull();
  });

  it("should NOT render global stats in the defeat screen (responsibility moved to shell)", () => {
    vi.spyOn(manager, "getState").mockReturnValue({
      status: "Defeat",
      nodes: [],
      rules: { difficulty: "normal" },
      history: [],
    } as any);

    screen.show();

    const footer = container.querySelector(".campaign-footer");
    expect(footer).toBeNull();
  });

  it("should NOT render global stats when no campaign is active (responsibility moved to shell)", () => {
    vi.spyOn(manager, "getState").mockReturnValue(null);
    screen.show();

    const footer = container.querySelector(".campaign-footer");
    expect(footer).toBeNull();
  });
});
