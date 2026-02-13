// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen - Dead Soldier Validation", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [
        { id: "soldier-1", archetypeId: "assault", name: "Dead Soldier", body: "light_recon" },
        { id: "soldier-2", archetypeId: "medic", name: "Healthy Soldier" },
      ],
      inventory: {},
    };

    mockManager = {
      getState: vi.fn().mockReturnValue({
        scrap: 1000,
        rules: { economyMode: "Open" },
        roster: [
          {
            id: "soldier-1",
            name: "Dead Soldier",
            status: "Dead",
            equipment: { rightHand: "pulse_rifle", leftHand: "combat_knife", body: "light_recon" },
            maxHp: 100,
            soldierAim: 90,
          },
          {
            id: "soldier-2",
            name: "Healthy Soldier",
            status: "Healthy",
            equipment: { rightHand: "pistol", leftHand: "combat_knife" },
            maxHp: 80,
            soldierAim: 80,
          },
        ],
      }),
      spendScrap: vi.fn(),
      assignEquipment: vi.fn(),
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should prevent equipping items on a dead soldier", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
      false,
      true,
    );
    screen.show();

    // 1. Select the dead soldier (already selected as index 0)

    // 2. Try to change weapon from armory
    const buttons = Array.from(container.querySelectorAll(".armory-item"));
    const shotgunBtn = buttons.find((el) => el.textContent?.includes("Shotgun")) as HTMLElement;

    expect(shotgunBtn).toBeTruthy();
    shotgunBtn.click();

    // 3. Verify that the config has NOT changed and spendScrap was NOT called
    expect(mockManager.spendScrap).not.toHaveBeenCalled();
    expect(mockManager.assignEquipment).not.toHaveBeenCalled();
  });

  it("should prevent removing items from a dead soldier", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
      false,
      true,
    );
    screen.show();

    // 1. Find the remove button for Body in the paper doll (optional slot)
    const slots = Array.from(container.querySelectorAll(".paper-doll-slot"));
    const secondarySlot = slots.find((s) =>
      s.textContent?.includes("Body"),
    );
    
    // With body set in initialConfig, it should be rendered
    const removeBtn = secondarySlot?.querySelector(
      ".slot-remove-btn",
    ) as HTMLElement;

    expect(removeBtn).toBeTruthy();
    
    // Try clicking it
    removeBtn.click();

    // 2. Verify assignEquipment was NOT called
    expect(mockManager.assignEquipment).not.toHaveBeenCalled();
  });

  it("should display a DECEASED warning for dead soldiers", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
      false,
      true,
    );
    screen.show();

    expect(container.textContent).toContain(
      "Soldier is Deceased - Equipment Locked",
    );
  });
});
