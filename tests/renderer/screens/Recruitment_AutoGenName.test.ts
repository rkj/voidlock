// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BarracksScreen } from "@src/renderer/screens/BarracksScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Recruitment Auto-Generated Name", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let mockModalService: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-barracks"></div>';
    container = document.getElementById("screen-barracks")!;

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(new MockStorageProvider());
    manager.startNewCampaign(12345, "normal");

    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      prompt: vi.fn().mockResolvedValue("Should Not Be Called"),
      show: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("should NOT call modalService.prompt when recruiting in BarracksScreen", async () => {
    const screen = new BarracksScreen(
      "screen-barracks",
      manager,
      mockModalService,
      vi.fn(),
    );
    screen.show();

    const recruitBtns = Array.from(container.querySelectorAll("button")).filter(
      (btn) => btn.textContent === "Recruit",
    ) as HTMLButtonElement[];

    expect(recruitBtns.length).toBeGreaterThan(0);

    // Click the first recruit button
    recruitBtns[0].click();

    // Give it a moment for any async calls (though we want it to be sync now or at least not call prompt)
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockModalService.prompt).not.toHaveBeenCalled();

    // Verify a soldier was added (initial is 4)
    expect(manager.getState()?.roster.length).toBe(5);
  });

  it("should NOT call modalService.prompt when recruiting in SquadBuilder", async () => {
    const { SquadBuilder } =
      await import("@src/renderer/components/SquadBuilder");
    const { AppContext } = await import("@src/renderer/app/AppContext");

    const context = new AppContext();
    context.campaignManager = manager;
    context.modalService = mockModalService;

    const squad = { soldiers: [] };

    // Kill one soldier so availableCount < 4
    const state = manager.getState()!;
    state.roster[0].status = "Dead";

    const screen = new SquadBuilder(
      "screen-barracks",
      context,
      squad as any,
      "DestroyHive" as any,
      true,
      vi.fn(),
    );
    screen.render();

    const recruitBtn = container.querySelector(
      ".btn-recruit",
    ) as HTMLButtonElement;
    expect(recruitBtn).toBeTruthy();

    recruitBtn.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockModalService.prompt).not.toHaveBeenCalled();

    // Verify a soldier was added (initial is 4)
    expect(manager.getState()?.roster.length).toBe(5);
  });
});
