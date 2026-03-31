import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("Regression voidlock-dw4z1: Terminal Offline text truncated", () => {
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
      soldiers: [{ archetypeId: "assault", name: "Soldier 1" }],
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
        roster: [{ id: "s1", name: "Soldier 1", archetypeId: "assault", status: "Healthy", equipment: {} }],
        scrap: 500,
        rules: { economyMode: "Open" },
        unlockedArchetypes: ["assault"],
      }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
    };

    onBack = vi.fn();
  });

  it("should have Terminal Offline message at the TOP of the Logistics & Supplies panel", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onBack,
      onUpdate: null as any,
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.setStoreLocked(true);
    screen.show();

    const rightPanelContent = container.querySelector(".armory-panel .scroll-content");
    expect(rightPanelContent).not.toBeNull();

    const children = rightPanelContent!.children;
    expect(children.length).toBeGreaterThan(1);

    // CURRENT BEHAVIOR: Armory items (from inspector.renderArmory()) come first, then locked message.
    // We WANT the locked message to be first to ensure it's visible and not cut off.
    
    const firstChild = children[0];
    
    // REQUIREMENT: It MUST be the first child to prevent truncation at the bottom of a long list.
    expect(firstChild.classList.contains("locked-store-message"), "Terminal Offline message should be the first child of the panel content").toBe(true);
  });
});
