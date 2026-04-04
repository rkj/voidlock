/**
 * Regression: Tutorial pickup step gets stuck because the prologue objective
 * has id "obj-1" (from the map generator), but InteractionBehavior only
 * recognizes "prologue-disk" or "artifact" as needing the "Pickup" channeling
 * action. All other objectives use "Collect", and completeCollect only sets
 * carriedObjectiveId for ids starting with "artifact". So the prologue
 * objective gets Completed directly without the unit ever carrying it.
 *
 * The tutorial's checkObjectiveCollected checks u.carriedObjectiveId === obj.id
 * which is never true, so the tutorial gets permanently stuck at the pickup step.
 *
 * The fix should ensure that after a player manually issues a PICKUP command
 * for a Recover objective in Prologue, the unit ends up with carriedObjectiveId
 * set — regardless of the objective's id format.
 */
import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("Regression: Prologue pickup step stuck — obj-1 id not recognized as carryable", () => {
  const createPrologueMap = () => ({
    width: 6,
    height: 4,
    cells: (() => {
      const cells = [];
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 6; x++) {
          cells.push({ x, y, type: "Floor" as const, roomId: `room-${x}-${y}` });
        }
      }
      return cells;
    })(),
    objectives: [
      {
        id: "obj-1",
        kind: "Recover" as const,
        targetCell: { x: 3, y: 2 },
      },
    ],
    squadSpawn: { x: 1, y: 1 },
    squadSpawns: [{ x: 1, y: 1 }],
    extraction: { x: 5, y: 1 },
    boundaries: [],
  });

  const squadConfig = {
    soldiers: [{ id: "lucia", archetypeId: "assault" }],
    inventory: {},
  };

  it("unit should carry objective after completing pickup of Recover objective with generic id", () => {
    const engine = new CoreEngine({
      map: createPrologueMap() as any,
      seed: 42,
      squadConfig: squadConfig as any,
      fogOfWarEnabled: false,
      debugOverlayEnabled: false,
      missionType: MissionType.Prologue,
    });

    // Place unit at the objective cell
    const state = engine.getState();
    const unit = state.units[0];
    unit.pos = { x: 3.5, y: 2.5 };
    unit.state = UnitState.Idle;

    // Player manually issues PICKUP command (as the tutorial instructs)
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: [unit.id],
      lootId: "obj-1",
      label: "Recovering",
    });

    // Tick until channeling starts
    for (let i = 0; i < 10; i++) {
      engine.update(50);
    }

    const channelingUnit = engine.getState().units[0];
    // The unit should be channeling (or already finished if fast enough)
    if (channelingUnit.state === UnitState.Channeling) {
      // Run enough ticks to complete the channeling (3s = ~60 ticks at 20tps)
      for (let i = 0; i < 80; i++) {
        engine.update(50);
      }
    }

    const finalUnit = engine.getState().units[0];
    const objective = engine.getState().objectives.find(o => o.id === "obj-1");

    // BUG: carriedObjectiveId is never set because "obj-1" doesn't match
    // "artifact" prefix in completeCollect, and InteractionBehavior treats it
    // as "Collect" rather than "Pickup" since it doesn't match "prologue-disk"
    expect(finalUnit.carriedObjectiveId).toBe("obj-1");

    // The objective should NOT be marked Completed yet — it should require
    // extraction first (the unit carries it to the extraction zone)
    expect(objective?.state).toBe("Pending");
  });

  it("tutorial checkObjectiveCollected logic finds carried objective", () => {
    // This mirrors what TutorialManager.checkObjectiveCollected does
    const mockState = {
      objectives: [
        { id: "obj-1", kind: "Recover" as const, state: "Pending" as const },
      ],
      units: [
        { id: "lucia", carriedObjectiveId: "obj-1" },
      ],
    };

    const obj = mockState.objectives.find(
      o => o.id === "prologue-disk" || o.kind === "Recover"
    );
    const hasCarrier = mockState.units.some(u => u.carriedObjectiveId === obj?.id);

    expect(obj).toBeDefined();
    expect(obj?.id).toBe("obj-1");
    expect(hasCarrier).toBe(true);
  });
});
