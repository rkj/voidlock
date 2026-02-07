// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ archetypeId: "assault" }, { archetypeId: "medic" }],
      inventory: { medkit: 1 },
    };

    mockManager = {
      getState: vi.fn().mockReturnValue({
        unlockedItems: ["heavy_plate"],
        roster: [
          {
            id: "assault-id",
            archetypeId: "assault",
            status: "Healthy",
            equipment: {},
          },
          {
            id: "medic-id",
            archetypeId: "medic",
            status: "Healthy",
            equipment: {},
          },
        ],
        scrap: 1000,
        rules: { economyMode: "Open" },
        unlockedArchetypes: ["assault", "medic", "heavy", "scout"],
      }),
      spendScrap: vi.fn(),
      assignEquipment: vi.fn(),
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should render soldier list on show", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    const soldierNames = Array.from(
      container.querySelectorAll(".soldier-list-panel .menu-item"),
    ).map((el) => el.textContent?.trim());
    expect(soldierNames.some((name) => name?.includes("Assault"))).toBe(true);
    expect(soldierNames.some((name) => name?.includes("Medic"))).toBe(true);
  });

  it("should allow selecting a soldier", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    let soldierItems = Array.from(
      container.querySelectorAll(".soldier-list-panel .menu-item.clickable"),
    ).filter((el) => el.textContent?.includes("Medic"));
    let medicItem = soldierItems[0] as HTMLElement;
    medicItem.click();

    // After clicking, it re-renders. We need to find the new element.
    soldierItems = Array.from(
      container.querySelectorAll(".soldier-list-panel .menu-item.clickable"),
    ).filter((el) => el.textContent?.includes("Medic"));
    medicItem = soldierItems[0] as HTMLElement;

    // After clicking, Medic should be active
    expect(medicItem.classList.contains("active")).toBe(true);
  });

  it("should pre-populate equipment from archetype defaults", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig, // assault has pulse_rifle and combat_knife in ArchetypeLibrary
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    // Check soldier list display
    const soldierListTexts = Array.from(
      container.querySelectorAll(
        ".soldier-list-panel .menu-item.clickable div",
      ),
    ).map((el) => el.textContent?.trim());
    expect(soldierListTexts.some((text) => text?.includes("Pulse Rifle"))).toBe(
      true,
    );
    expect(
      soldierListTexts.some((text) => text?.includes("Combat Knife")),
    ).toBe(true);

    // Check paper doll slots in center panel
    const slots = Array.from(
      container.querySelectorAll(".soldier-equipment-panel .paper-doll-slot"),
    );
    const rightHandSlot = slots.find((el) =>
      el.textContent?.includes("Right Hand"),
    );
    const leftHandSlot = slots.find((el) =>
      el.textContent?.includes("Left Hand"),
    );

    expect(rightHandSlot?.textContent).toContain("Pulse Rifle");
    expect(leftHandSlot?.textContent).toContain("Combat Knife");
  });

  it("should allow adding global items", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    // Find Frag Grenade row in armory panel (global supplies section)
    const rows = Array.from(
      container.querySelectorAll(".armory-panel .card"),
    ).filter((el) => el.textContent?.includes("Frag Grenade"));
    const row = rows[0] as HTMLElement;
    const plusBtn = Array.from(row.querySelectorAll("button")).find(
      (btn) => btn.textContent === "+",
    );

    plusBtn?.click();

    const confirmBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Confirm Squad",
    );
    confirmBtn?.click();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        inventory: expect.objectContaining({
          frag_grenade: 1,
          medkit: 1,
        }),
      }),
    );
  });

  it("should allow assigning weapons to soldiers", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    // Selected soldier is Assault (index 0)
    // Find "Pulse Rifle" in armory panel
    const pulseRifleBtn = Array.from(
      container.querySelectorAll(".armory-panel .menu-item.clickable"),
    ).find((el) => el.textContent?.includes("Pulse Rifle")) as HTMLElement;
    pulseRifleBtn?.click();

    const confirmBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Confirm Squad",
    );
    confirmBtn?.click();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        soldiers: expect.arrayContaining([
          expect.objectContaining({
            archetypeId: "assault",
            rightHand: "pulse_rifle",
          }),
        ]),
      }),
    );
  });

  it("should calculate stats correctly", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    // Default Assault HP is 100
    // Find Heavy Plate Armor in armory panel
    const armorBtn = Array.from(
      container.querySelectorAll(".armory-panel .menu-item.clickable"),
    ).find((el) =>
      el.textContent?.includes("Heavy Plate Armor"),
    ) as HTMLElement;
    armorBtn?.click();

    // Heavy Plate gives +150 HP
    const soldierStatsDiv = Array.from(container.querySelectorAll("h3")).find(
      (el) => el.textContent === "Soldier Attributes",
    )?.parentElement;
    expect(soldierStatsDiv?.textContent).toContain("250"); // 100 + 150

    // Check Speed - should be 15 (20 - 5 penalty)
    expect(soldierStatsDiv?.textContent).toContain("15");
  });

  it("should trigger onBack", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    const backBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Back",
    );
    backBtn?.click();

    expect(onBack).toHaveBeenCalled();
  });

  it("should display soldier name in the list", () => {
    const configWithNames: any = {
      soldiers: [{ archetypeId: "assault", name: "Captain Kirk" }],
      inventory: {},
    };
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      configWithNames,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    const soldierNames = Array.from(
      container.querySelectorAll(".soldier-list-panel div"),
    ).map((el) => el.textContent?.trim());
    expect(soldierNames.some((name) => name?.includes("Captain Kirk"))).toBe(
      true,
    );
    // Should also show class
    expect(soldierNames.some((name) => name?.includes("Assault"))).toBe(true);
  });
});
