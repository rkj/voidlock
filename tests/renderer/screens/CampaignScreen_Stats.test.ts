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
    
    screen = new CampaignScreen(
      "screen-campaign",
      manager,
      modalService,
      vi.fn(),
      vi.fn()
    );
  });

  it("should render global stats in the setup wizard (no campaign)", () => {
    vi.spyOn(manager, "getState").mockReturnValue(null);
    screen.show();

    const footer = container.querySelector(".campaign-footer");
    expect(footer).not.toBeNull();
    const text = footer?.textContent || "";
    expect(text).toContain("Lifetime Xeno Purged:");
    expect(text).toContain("10");
    expect(text).toContain("Expeditions:");
    expect(text).toContain("1");
    expect(text).toContain("Missions Won:");
    expect(text).toContain("1");
  });

  it("should render global stats in the campaign map", () => {
    vi.spyOn(manager, "getState").mockReturnValue({
      status: "Active",
      nodes: [],
      rules: { difficulty: "normal" },
      history: []
    } as any);
    
    screen.show();

    const footer = container.querySelector(".campaign-footer");
    expect(footer).not.toBeNull();
    const text = footer?.textContent || "";
    expect(text).toContain("Lifetime Xeno Purged:");
    expect(text).toContain("10");
  });

  it("should render global stats in the victory screen", () => {
    vi.spyOn(manager, "getState").mockReturnValue({
      status: "Victory",
      nodes: [],
      rules: { difficulty: "normal" },
      history: []
    } as any);
    
    screen.show();

    const footer = container.querySelector(".campaign-footer");
    expect(footer).not.toBeNull();
    const text = footer?.textContent || "";
    expect(text).toContain("Lifetime Xeno Purged:");
    expect(text).toContain("10");
  });
});
