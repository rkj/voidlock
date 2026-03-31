// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { setLocale } from "@src/renderer/i18n";

describe("Regression 6k8w: Supply Prices", () => {
  let mockManager: any;
  let themeManager: any;
  let mockModalService: any;
  let mockInputDispatcher: any;

  beforeEach(() => {
    setLocale("en-standard");
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    
    mockManager = new CampaignManager(
      new MockStorageProvider(),
      new MetaManager(new MockStorageProvider())
    );
    mockManager.startNewCampaign({ seed: 123, difficulty: "Standard" });
    
    themeManager = {
      getAssetUrl: vi.fn().mockReturnValue("test.png"),
    };
    mockModalService = {
      show: vi.fn(),
    };
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
  });

  it("should show supply prices in the UI row, not just in title", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: { 
        unitIds: ["u1"], 
        soldiers: [{ id: "u1", name: "Test", archetypeId: "assault", hp: 100, maxHp: 100, soldierAim: 90, rightHand: "pulse_rifle" }], 
        inventory: {} 
      } as any,
      onBack: vi.fn(),
      onLaunch: vi.fn(),
      isShop: true,
      isCampaign: true,
    });

    screen.show();
    
    const grenadeRow = document.querySelector(".item-card[data-id='frag_grenade']");
    expect(grenadeRow).not.toBeNull();
    
    // NEW EXPECTED BEHAVIOR:
    expect(grenadeRow!.textContent).toContain("15 CR");
    expect(grenadeRow!.title).not.toContain("Cost:");
  });
});
