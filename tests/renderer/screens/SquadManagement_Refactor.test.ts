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
  let mockModalService: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ id: "s1", name: "Soldier 1", archetypeId: "assault" }],
      inventory: {},
    };

    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
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
            level: 1,
            xp: 0,
            hp: 100,
            maxHp: 100,
            soldierAim: 60,
          },
          {
            id: "s2",
            name: "Soldier 2",
            archetypeId: "medic",
            status: "Healthy",
            equipment: {},
            level: 1,
            xp: 0,
            hp: 100,
            maxHp: 100,
            soldierAim: 60,
          },
          {
            id: "s3",
            name: "Soldier 3",
            archetypeId: "scout",
            status: "Dead",
            equipment: {},
            level: 1,
            xp: 0,
            hp: 100,
            maxHp: 100,
            soldierAim: 60,
          },
        ],
        scrap: 500,
        unlockedArchetypes: ["assault", "medic", "heavy", "scout"],
        unlockedItems: [],
        rules: { economyMode: "Open" },
      }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
      spendScrap: vi.fn(),
      assignEquipment: vi.fn(),
      recruitSoldier: vi.fn().mockReturnValue("s4"),
      reviveSoldier: vi.fn(),
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should show 4 slots in the soldier list even if fewer soldiers are in squad", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      undefined,
      false,
      true
    );
    screen.show();

    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    expect(slots.length).toBe(4);
    expect(slots[0].textContent).toContain("Soldier 1");
    expect(slots[1].textContent).toContain("[Empty Slot]");
  });

  it("should show Recruit/Revive options in the inspector when an empty slot is selected", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      undefined,
      false,
      true
    );
    screen.show();

    // Select the second slot (empty)
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    (slots[1] as HTMLElement).click();

    const inspector = container.querySelector(".soldier-equipment-panel");
    expect(inspector?.textContent).toContain("Recruit New Soldier");
    expect(inspector?.textContent).toContain("Revive Fallen Soldier");
  });

  it("should show available roster soldiers in the Right Panel when an empty slot is selected", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      undefined,
      false,
      true
    );
    screen.show();

    // Select the second slot (empty)
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    (slots[1] as HTMLElement).click();

    const rightPanel = container.querySelector(".armory-panel");
    expect(rightPanel?.textContent).toContain("Reserve Roster");
    expect(rightPanel?.textContent).toContain("Soldier 2");
  });

  it("should allow adding a soldier from the roster to an empty slot", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      undefined,
      false,
      true
    );
    screen.show();

    // Select the second slot (empty)
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    (slots[1] as HTMLElement).click();

    // Find Soldier 2 in roster picker and click it
    const rosterItems = Array.from(
      container.querySelectorAll(".armory-panel .menu-item"),
    );
    const soldier2Item = rosterItems.find((el) => el.textContent?.includes("Soldier 2")) as HTMLElement;
    expect(soldier2Item).toBeTruthy();
    soldier2Item.click();

    // Verify it's now in the squad config
    const backBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Back",
    );
    backBtn?.click();

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
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      undefined,
      false,
      true
    );
    screen.show();

    // Click remove button on the first soldier
    const removeBtn = container.querySelector(
      ".remove-soldier-btn",
    ) as HTMLElement;
    removeBtn.click();

    // Verify it's gone from squad config
    const backBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Back",
    );
    backBtn?.click();

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
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      undefined,
      false,
      true
    );
    screen.show();

    // Select the second slot (empty)
    const slots = container.querySelectorAll(".soldier-list-panel .menu-item");
    (slots[1] as HTMLElement).click();

    // Click Recruit New Soldier in inspector
    const recruitBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Recruit New Soldier"),
    );
    recruitBtn?.click();

    const rightPanel = container.querySelector(".armory-panel");
    expect(rightPanel?.textContent).toContain("Recruitment");
    expect(rightPanel?.textContent).toContain("Assault");
    expect(rightPanel?.textContent).toContain("Medic");
  });
});
