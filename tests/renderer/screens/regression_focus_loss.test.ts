import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen Focus Regression", () => {
  let mockInputDispatcher: any;
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;

  beforeEach(() => {
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [],
      inventory: {},
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
      spendScrap: vi.fn(),
      assignEquipment: vi.fn(),
      recruitSoldier: vi.fn().mockReturnValue("new-id"),
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should PRESERVE focus when clicking 'Acquire New Asset' because of re-render", () => {
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
      onBack: onSave,
      onUpdate: onBack,
      onLaunch: undefined,
      isShop: false,
      isCampaign: true // isCampaign
    });
    screen.show();

    // 1. Find the "Acquire New Asset" button
    const recruitBtn = container.querySelector(".recruit-btn-large") as HTMLButtonElement;
    expect(recruitBtn).not.toBeNull();

    // 2. Focus it
    recruitBtn.focus();
    expect(document.activeElement).toBe(recruitBtn);

    // 3. Click it
    recruitBtn.click();

    // 4. Check focus - it SHOULD now be moved to the first recruitment option,
    // OR stay on the button if it still exists.
    // In our case, onRecruit moves focus to first recruitment option.
    const firstOption = container.querySelector(".armory-panel .clickable") as HTMLElement;
    expect(document.activeElement).toBe(firstOption);
    
    // Check if we are now in recruitment mode
    const title = container.querySelector(".armory-panel .panel-title");
    expect(title?.textContent).toBe("Procurement");
  });
});
