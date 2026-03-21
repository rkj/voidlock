import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("Regression 6k8w: Supply Prices", () => {
  let mockInputDispatcher: any;
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let mockManager: any;

  beforeEach(() => {
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    mockManager = {
      getState: vi.fn().mockReturnValue({ scrap: 1000, intel: 0, roster: [] }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
    };
  });

  it("should show supply prices in the UI row, not just in title", () => {
    const mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const screen = new EquipmentScreen({
      inputDispatcher: (typeof mockInputDispatcher !== 'undefined' ? mockInputDispatcher : InputDispatcher.getInstance()) as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: vi.fn(),
      onUpdate: // onBack
      vi.fn(),
      onLaunch: // onUpdate
      undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    // Find Frag Grenade row
    const supplyItems = Array.from(container.querySelectorAll(".card"));
    const grenadeRow = supplyItems.find((el) =>
      el.textContent?.includes("Frag Grenade"),
    ) as HTMLElement;

    expect(grenadeRow).toBeDefined();

    // CURRENT BEHAVIOR (to be changed):
    // Cost is in title, but NOT in textContent
    // expect(grenadeRow!.title).toContain("Cost: 15 CR");
    // expect(grenadeRow!.textContent).not.toContain("15 CR");

    // NEW EXPECTED BEHAVIOR:
    expect(grenadeRow!.textContent).toContain("15 CR");
    expect(grenadeRow!.title).not.toContain("Cost:");
  });
});
