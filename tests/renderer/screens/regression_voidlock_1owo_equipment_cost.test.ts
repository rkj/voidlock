import { InputDispatcher } from "@src/renderer/InputDispatcher";
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";
import { SquadConfig } from "@src/shared/types";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("EquipmentScreen Economics", () => {
  let mockInputDispatcher: any;
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;
  let mockState: any;
  let mockModalService: any;
  let shell: CampaignShell;

  beforeEach(() => {
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };
    document.body.innerHTML = `
      <div id="screen-campaign-shell">
        <div id="campaign-shell-top-bar"></div>
        <div id="screen-equipment"></div>
      </div>
    `;
    container = document.getElementById("screen-equipment")!;

    mockState = {
      scrap: 100,
      intel: 0,
      currentSector: 1,
      status: "Active",
      roster: [
        {
          id: "s1",
          archetypeId: "assault",
          equipment: { rightHand: "pulse_rifle", leftHand: "combat_knife" },
        },
      ],
    };

    initialConfig = {
      soldiers: [
        {
          id: "s1",
          archetypeId: "assault",
          rightHand: "pulse_rifle",
          leftHand: "combat_knife",
        },
      ],
      inventory: {},
    };

    mockManager = {
      getState: vi.fn(() => mockState),
        getStorage: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
      spendScrap: vi.fn((amount) => {
        mockState.scrap -= amount;
      }),
      assignEquipment: vi.fn(),
    };

    onSave = vi.fn();
    onBack = vi.fn();

    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const mockMetaManager = {
      getStats: vi.fn().mockReturnValue({
        totalKills: 100,
        totalCampaignsStarted: 5,
        totalMissionsWon: 20,
      }),
    };

    shell = new CampaignShell({containerId: "screen-campaign-shell",
      manager: mockManager,
      metaManager: mockMetaManager as any,
      onTabChange: vi.fn(),
      onMenu: vi.fn(),
      inputDispatcher: { pushContext: vi.fn(), popContext: vi.fn() } as any});
    shell.show("campaign");
  });

  it("should not charge for items already in roster", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onSave,
      onUpdate: () => shell.refresh(),
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(
      (p) =>
        p.querySelector(".panel-title")?.textContent === t(I18nKeys.screen.equipment.logistics_supplies),
    ) as HTMLElement;

    // Re-select Pulse Rifle (already equipped and in roster)
    const pulseRifleBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes(t(I18nKeys.units.item.pulse_rifle))) as HTMLElement;

    pulseRifleBtn?.click();

    expect(mockManager.spendScrap).not.toHaveBeenCalled();
    expect(mockState.scrap).toBe(100);
  });

  it("should charge for new items", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onSave,
      onUpdate: () => shell.refresh(),
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(
      (p) =>
        p.querySelector(".panel-title")?.textContent === t(I18nKeys.screen.equipment.logistics_supplies),
    ) as HTMLElement;

    // Select Pistol (cost 10)
    const pistolBtn = armoryPanel.querySelector('[data-focus-id="armory-item-pistol"]') as HTMLElement;
    expect(pistolBtn).not.toBeNull();
    pistolBtn?.click();

    expect(mockManager.spendScrap).toHaveBeenCalledWith(10);
    expect(mockState.scrap).toBe(90);
  });

  it("should prevent equipping items that cannot be afforded", () => {
    mockState.scrap = 5; // Cannot afford Pistol (10)
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onSave,
      onUpdate: () => shell.refresh(),
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(
      (p) =>
        p.querySelector(".panel-title")?.textContent === t(I18nKeys.screen.equipment.logistics_supplies),
    ) as HTMLElement;

    const pistolBtn = armoryPanel.querySelector('[data-focus-id="armory-item-pistol"]') as HTMLElement;
    expect(pistolBtn).not.toBeNull();

    // Check it's disabled or at least doesn't trigger spendScrap
    pistolBtn?.click();

    expect(mockManager.spendScrap).not.toHaveBeenCalled();
    expect(mockState.scrap).toBe(5);
  });

  it("should update Scrap display after purchase", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onSave,
      onUpdate: () => shell.refresh(),
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(
      (p) =>
        p.querySelector(".panel-title")?.textContent === t(I18nKeys.screen.equipment.logistics_supplies),
    ) as HTMLElement;

    const getScrapText = () => {
      const topBar = document.getElementById("campaign-shell-top-bar")!;
      return topBar.textContent || "";
    };

    expect(getScrapText()).toContain(t(I18nKeys.hud.credits));
    expect(getScrapText()).toContain("100");

    const pistolBtn = armoryPanel.querySelector('[data-focus-id="armory-item-pistol"]') as HTMLElement;
    expect(pistolBtn).not.toBeNull();
    pistolBtn?.click();

    expect(getScrapText()).toContain(t(I18nKeys.hud.credits));
    expect(getScrapText()).toContain("90");
  });

  it("should not charge for unequipping", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onSave,
      onUpdate: () => shell.refresh(),
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    // Find the Right Hand slot remove button
    const slots = Array.from(container.querySelectorAll(".paper-doll-slot"));
    const rhSlot = slots.find((s) =>
      s.textContent?.includes(t(I18nKeys.screen.inspector.primary_rh)),
    ) as HTMLElement;
    const removeBtn = rhSlot.querySelector(
      ".slot-remove-btn",
    ) as HTMLElement;

    removeBtn?.click();

    expect(mockManager.spendScrap).not.toHaveBeenCalled();
    expect(mockState.scrap).toBe(100);
  });

  it("should allow re-equipping original roster items for free", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onSave,
      onUpdate: () => shell.refresh(),
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    const armoryPanel = Array.from(container.querySelectorAll(".panel")).find(
      (p) =>
        p.querySelector(".panel-title")?.textContent === t(I18nKeys.screen.equipment.logistics_supplies),
    ) as HTMLElement;

    // 1. Unequip Pulse Rifle
    const slots = Array.from(container.querySelectorAll(".paper-doll-slot"));
    const rhSlot = slots.find((s) =>
      s.textContent?.includes(t(I18nKeys.screen.inspector.primary_rh)),
    ) as HTMLElement;
    const removeBtn = rhSlot.querySelector(
      ".slot-remove-btn",
    ) as HTMLElement;
    removeBtn?.click();

    // 2. Re-equip Pulse Rifle from armory
    const pulseRifleBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes(t(I18nKeys.units.item.pulse_rifle))) as HTMLElement;
    pulseRifleBtn?.click();

    expect(mockManager.spendScrap).not.toHaveBeenCalled();
    expect(mockState.scrap).toBe(100);
  });

  it("should show Owned for items in roster", () => {
    const screen = new EquipmentScreen({
      inputDispatcher: mockInputDispatcher as any,
      containerId: "screen-equipment",
      campaignManager: mockManager,
      modalService: mockModalService as any,
      currentSquad: initialConfig,
      onBack: onSave,
      onUpdate: () => shell.refresh(),
      onLaunch: undefined,
      isShop: false,
      isCampaign: true
    });
    screen.show();

    // Find the Armory panel
    const panels = Array.from(container.querySelectorAll(".panel"));
    const armoryPanel = panels.find(
      (p) =>
        p.querySelector(".panel-title")?.textContent === t(I18nKeys.screen.equipment.logistics_supplies),
    ) as HTMLElement;

    const pulseRifleBtn = Array.from(
      armoryPanel.querySelectorAll(".menu-item.clickable"),
    ).find((el) => el.textContent?.includes(t(I18nKeys.units.item.pulse_rifle))) as HTMLElement;

    expect(pulseRifleBtn.textContent).toContain(t(I18nKeys.screen.inspector.owned));
  });
});
