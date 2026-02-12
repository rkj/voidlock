// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen - Squad Management Refactor", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ id: "s1", name: "Soldier 1", archetypeId: "assault" }],
      inventory: {},
    };

    mockManager = {
      getState: vi.fn().mockReturnValue({
        roster: [
          {
            id: "s1",
            name: "Soldier 1",
            archetypeId: "assault",
            status: "Healthy",
            equipment: {},
          },
          {
            id: "s2",
            name: "Soldier 2",
            archetypeId: "medic",
            status: "Healthy",
            equipment: {},
          },
          {
            id: "s3",
            name: "Soldier 3",
            archetypeId: "scout",
            status: "Dead",
            equipment: {},
          },
        ],
        scrap: 100,
        unlockedArchetypes: ["assault", "medic", "heavy", "scout"],
        unlockedItems: [],
        rules: { economyMode: "Open" },
      }),
      spendScrap: vi.fn(),
      assignEquipment: vi.fn(),
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should show 4 slots in the soldier list even if fewer soldiers are in squad", () => {
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

    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    expect(slots.length).toBe(4);
    expect(slots[0].textContent).toContain("SOLDIER 1");
    expect(slots[1].textContent).toContain("EMPTY SLOT");
    expect(slots[2].textContent).toContain("EMPTY SLOT");
    expect(slots[3].textContent).toContain("EMPTY SLOT");
  });

  it("should show Recruit/Revive options in the inspector when an empty slot is selected", () => {
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

    // Select the second slot (empty)
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    (slots[1] as HTMLElement).click();

    const inspector = container.querySelector(".soldier-equipment-panel");
    expect(inspector?.textContent).toContain("RECRUIT NEW SOLDIER");
    expect(inspector?.textContent).toContain("REVIVE FALLEN SOLDIER");
  });

  it("should show available roster soldiers in the Right Panel when an empty slot is selected", () => {
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

    // Select the second slot (empty)
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    (slots[1] as HTMLElement).click();

    const rightPanel = container.querySelector(".armory-panel");
    expect(rightPanel?.textContent).toContain("RESERVE ROSTER");
    expect(rightPanel?.textContent).toContain("SOLDIER 2");
    // Soldier 1 is already in squad, so it shouldn't be here or should be marked
    // Soldier 3 is dead, so it should be in Revive section of inspector, not here?
    // Actually spec says "Add: 'Empty Slot' buttons open the Reserve Roster picker."
  });

  it("should allow adding a soldier from the roster to an empty slot", () => {
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

    // Select the second slot (empty)
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    (slots[1] as HTMLElement).click();

    // Find Soldier 2 in roster picker and click it
    const rosterItem = Array.from(
      container.querySelectorAll(".armory-panel .menu-item"),
    ).find((el) => el.textContent?.includes("SOLDIER 2")) as HTMLElement;
    rosterItem.click();

    // Verify it's now in the squad config
    const confirmBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "CONFIRM SQUAD",
    );
    confirmBtn?.click();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        soldiers: expect.arrayContaining([
          expect.objectContaining({ id: "s1" }),
          expect.objectContaining({ id: "s2" }),
        ]),
      }),
    );
  });

  it("should allow removing a soldier from the squad", () => {
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

    // Click remove button on the first soldier
    const removeBtn = container.querySelector(
      ".remove-soldier-btn",
    ) as HTMLElement;
    removeBtn.click();

    // Verify it's gone from squad config
    const confirmBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "CONFIRM SQUAD",
    );
    confirmBtn?.click();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        soldiers: [],
      }),
    );
  });

  it("should show available archetypes in recruitment picker", () => {
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

    // Select the second slot (empty)
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    (slots[1] as HTMLElement).click();

    // Click Recruit New Soldier in inspector
    const recruitBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("RECRUIT NEW SOLDIER"),
    );
    recruitBtn?.click();

    const rightPanel = container.querySelector(".armory-panel");
    expect(rightPanel?.textContent).toContain("RECRUITMENT");
    expect(rightPanel?.textContent).toContain("ASSAULT");
    expect(rightPanel?.textContent).toContain("MEDIC");
  });
});
