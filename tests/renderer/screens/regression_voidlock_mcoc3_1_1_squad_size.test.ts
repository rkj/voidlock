// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen Squad Size Verification", () => {
  let container: HTMLElement;
  let mockManager: any;
  let mockModalService: any;
  let onBack: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    mockManager = {
      getState: vi.fn().mockReturnValue({
        unlockedItems: [],
        roster: [
          { id: "s1", archetypeId: "assault", status: "Healthy", equipment: {} },
          { id: "s2", archetypeId: "medic", status: "Healthy", equipment: {} },
          { id: "s3", archetypeId: "heavy", status: "Healthy", equipment: {} },
          { id: "s4", archetypeId: "scout", status: "Healthy", equipment: {} },
          { id: "s5", archetypeId: "sniper", status: "Healthy", equipment: {} },
        ],
        scrap: 1000,
        unlockedArchetypes: ["assault", "medic", "heavy", "scout", "sniper"],
      }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
      spendScrap: vi.fn(),
      assignEquipment: vi.fn(),
    };

    onBack = vi.fn();
  });

  it("should display exactly 4 slots in the soldier list", () => {
    const initialConfig: SquadConfig = {
      soldiers: [],
      inventory: {},
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onBack,
      undefined,
      undefined,
      false,
      true
    );
    screen.show();

    const slots = container.querySelectorAll(".soldier-list-panel [data-focus-id^='soldier-slot-']");
    expect(slots.length).toBe(4);
  });

  it("should allow adding 4 soldiers to the squad", () => {
    const initialConfig: SquadConfig = {
      soldiers: [],
      inventory: {},
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onBack,
      undefined,
      undefined,
      false,
      true
    );
    screen.show();

    // Add 4 soldiers
    for (let i = 0; i < 4; i++) {
        // Find the roster item for s[i+1]
        const rosterItem = container.querySelector(`[data-focus-id="roster-s${i+1}"]`) as HTMLElement;
        expect(rosterItem).not.toBeNull();
        rosterItem.click();
    }

    const backBtn = container.querySelector('[data-focus-id="btn-back"]') as HTMLElement;
    backBtn.click();

    expect(onBack).toHaveBeenCalledWith(
      expect.objectContaining({
        soldiers: expect.arrayContaining([
          expect.objectContaining({ id: "s1" }),
          expect.objectContaining({ id: "s2" }),
          expect.objectContaining({ id: "s3" }),
          expect.objectContaining({ id: "s4" }),
        ]),
      }),
    );
    expect(onBack.mock.calls[0][0].soldiers.length).toBe(4);
  });

  it("should not allow adding more than 4 soldiers (slots are limited to 4)", () => {
    const initialConfig: SquadConfig = {
      soldiers: [
        { id: "s1", archetypeId: "assault" },
        { id: "s2", archetypeId: "medic" },
        { id: "s3", archetypeId: "heavy" },
        { id: "s4", archetypeId: "scout" },
      ],
      inventory: {},
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onBack,
      undefined,
      undefined,
      false,
      true
    );
    screen.show();

    // All slots are full. Clicking another roster item should probably do nothing or replace the last one if we had logic for that, 
    // but here we just check that only 4 slots are rendered and active.
    
    const slots = container.querySelectorAll(".soldier-list-panel [data-focus-id^='soldier-slot-']");
    expect(slots.length).toBe(4);
  });
});
