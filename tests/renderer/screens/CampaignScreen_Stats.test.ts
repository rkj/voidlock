/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { ModalService } from "@src/renderer/ui/ModalService";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { InputDispatcher } from "@src/renderer/InputDispatcher";

describe("CampaignScreen - Global Stats", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let modalService: ModalService;
  let screen: CampaignScreen;
  let storage: MockStorageProvider;
  let themeManager: ThemeManager;
  let inputDispatcher: InputDispatcher;

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
    
    new MetaManager(storage);

    // Initialize stats
    const meta = new MetaManager(new MockStorageProvider());
    meta.recordCampaignStarted();
    meta.recordMissionResult(10, 2, true, 100);

    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
    modalService = new ModalService();
    themeManager = new ThemeManager();
    vi.spyOn(themeManager, "init").mockResolvedValue(undefined);
    vi.spyOn(themeManager, "getAssetUrl").mockReturnValue("mock-url");
    inputDispatcher = new InputDispatcher();

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

    screen = new CampaignScreen({
      metaManager: new MetaManager(new MockStorageProvider()),
      containerId: "screen-campaign",
      campaignManager: manager,
      themeManager: themeManager as any,
      inputDispatcher: inputDispatcher as any,
      modalService: modalService as any,
      onNodeSelect: vi.fn(),
      onMainMenu: vi.fn()
    });
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
