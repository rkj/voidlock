import { describe, it, expect } from "vitest";
import { FormationManager } from "@src/engine/managers/FormationManager";
import { GameGrid } from "@src/engine/GameGrid";
import { MapDefinition, Unit, UnitState, CellType } from "@src/shared/types";

describe("FormationManager", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: Array.from({ length: 100 }, (_, i) => ({
      x: i % 10,
      y: Math.floor(i / 10),
      type: CellType.Floor,
    })),
  };
  const grid = new GameGrid(mockMap);
  const formationManager = new FormationManager();

  it("should assign roles to escorts", () => {
    const targetUnit: Unit = {
      id: "target",
      pos: { x: 5.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: { speed: 1 } as any,
    } as any;

    const escorts: Unit[] = [
      { id: "escort1", pos: { x: 4.5, y: 4.5 }, stats: { speed: 1 } } as any,
      { id: "escort2", pos: { x: 6.5, y: 6.5 }, stats: { speed: 1 } } as any,
    ];

    const roles = formationManager.assignEscortRoles(escorts, targetUnit, grid);

    expect(roles.size).toBe(2);
    expect(roles.has("escort1")).toBe(true);
    expect(roles.has("escort2")).toBe(true);
  });
});
