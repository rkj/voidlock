// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("Regression: Shop Node Label", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onBack: any;
  let mockManager: any;
  let mockModalService: any;

  beforeEach(() => {
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
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onBack,
      undefined,
      undefined,
      true, // isShop = true
      true // isCampaign = true
    );
    
    screen.show();

    const backBtn = container.querySelector('[data-focus-id="btn-back"]');
    
    // This should now PASS
    expect(backBtn?.textContent).toBe("Leave Shop");
  });

  it("should show 'Back' label on back button when isShop is false", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onBack,
      undefined,
      undefined,
      false, // isShop = false
      true // isCampaign = true
    );
    
    screen.show();

    const backBtn = container.querySelector('[data-focus-id="btn-back"]');
    
    expect(backBtn?.textContent).toBe("Back");
  });
});
