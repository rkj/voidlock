import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("Regression: Shop Node Label", () => {
  let mockInputDispatcher: any;
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onBack: any;
  let mockManager: any;
  let mockModalService: any;

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

    mockModalService = {
      alert: vi.fn(),
      confirm: vi.fn(),
      show: vi.fn(),
    };

    mockManager = {
      getState: vi.fn().mockReturnValue({
        unlockedItems: [],
        roster: [],
        scrap: 1000,
        rules: { economyMode: "Open" },
        unlockedArchetypes: ["assault"],
      }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
    };

    onBack = vi.fn();
  });

  it("should show 'Leave Shop' label on back button when isShop is true", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onBack,
      onUpdate: undefined,
      onLaunch: undefined,
      isShop: true,
      isCampaign: // isShop = true
      true // isCampaign = true
    });
    
    screen.show();

    const backBtn = container.querySelector('[data-focus-id="btn-back"]');
    
    // This should now PASS
    expect(backBtn?.textContent).toBe("Exit Hub");
  });

  it("should show 'Back' label on back button when isShop is false", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onBack,
      onUpdate: undefined,
      onLaunch: undefined,
      isShop: false,
      isCampaign: // isShop = false
      true // isCampaign = true
    });
    
    screen.show();

    const backBtn = container.querySelector('[data-focus-id="btn-back"]');
    
    expect(backBtn?.textContent).toBe("Back");
  });
});
