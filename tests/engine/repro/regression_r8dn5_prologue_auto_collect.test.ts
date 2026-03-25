/**
 * Regression r8dn5: Tutorial pickup step gets stuck because InteractionBehavior
 * auto-collects the objective before the player can follow the tutorial prompt.
 *
 * Scenario: During the prologue tutorial, the "move" step sends the unit to the
 * objective room. When the unit arrives and goes Idle at the objective cell,
 * InteractionBehavior kicks in and starts channeling to collect the disk
 * automatically — even though no PICKUP command was issued. The tutorial then
 * tells the player "Press [4] Pickup > Select DATA DISK" but the item is already
 * gone, leaving the player stuck.
 *
 * ObjectiveBehavior correctly bails out for Prologue missions (line 53), but
 * InteractionBehavior's objective interaction section has no such guard.
 *
 * Fix: In Prologue, InteractionBehavior should only channel on objectives when
 * the unit has an explicit PICKUP command (i.e., the player issued it manually).
 */
import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("Regression r8dn5: Prologue tutorial pickup step should not auto-collect", () => {
  const createPrologueMap = () => {
    const map = {
      width: 6,
      height: 4,
      cells: [] as any[],
      objectives: [
        {
          id: "prologue-disk",
          kind: "Recover" as const,
          targetCell: { x: 3, y: 2 },
          state: "Pending" as const,
          visible: true,
        },
      ],
      squadSpawn: { x: 1, y: 1 },
      extraction: { x: 5, y: 1 },
      boundaries: [],
    };

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 6; x++) {
        map.cells.push({ x, y, type: "Floor" });
      }
    }
    return map;
  };

  const squadConfig = {
    soldiers: [{ id: "lucia", archetypeId: "assault" }],
    inventory: {},
  };

  it("unit idle at objective cell should NOT auto-collect in Prologue", () => {
    const engine = new CoreEngine({
      map: createPrologueMap() as any,
      seed: 42,
      squadConfig: squadConfig as any,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      missionType: MissionType.Prologue,
    });

    // Simulate: unit arrived at objective cell via the tutorial "move" step
    const unit = engine.getState().units[0];
    unit.pos = { x: 3.5, y: 2.5 };
    unit.state = UnitState.Idle;
    unit.activeCommand = undefined;

    // Run several ticks — InteractionBehavior should NOT start channeling
    for (let i = 0; i < 20; i++) {
      engine.update(50);
    }

    const finalUnit = engine.getState().units[0];
    expect(finalUnit.state).not.toBe(UnitState.Channeling);
    expect(finalUnit.carriedObjectiveId).toBeUndefined();
  });

  it("explicit PICKUP command should still work in Prologue", () => {
    const engine = new CoreEngine({
      map: createPrologueMap() as any,
      seed: 42,
      squadConfig: squadConfig as any,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      missionType: MissionType.Prologue,
    });

    const unit = engine.getState().units[0];
    unit.pos = { x: 3.5, y: 2.5 };
    unit.state = UnitState.Idle;

    // Player manually issues PICKUP via the tutorial prompt
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["lucia"],
      lootId: "prologue-disk",
      label: "Recovering",
    });

    engine.update(50);

    const afterPickup = engine.getState().units[0];
    expect(afterPickup.state).toBe(UnitState.Channeling);
    expect(afterPickup.channeling?.action).toBe("Pickup");
  });

  it("non-Prologue missions should still auto-collect (existing behavior)", () => {
    const map = createPrologueMap();
    map.objectives[0].id = "artifact1";

    const engine = new CoreEngine({
      map: map as any,
      seed: 42,
      squadConfig: squadConfig as any,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
    });

    const unit = engine.getState().units[0];
    unit.pos = { x: 3.5, y: 2.5 };
    unit.state = UnitState.Idle;
    unit.activeCommand = undefined;

    for (let i = 0; i < 20; i++) {
      engine.update(50);
    }

    const finalUnit = engine.getState().units[0];
    expect(finalUnit.state).toBe(UnitState.Channeling);
  });
});
