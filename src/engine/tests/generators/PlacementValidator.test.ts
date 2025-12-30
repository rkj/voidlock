import { describe, it, expect } from "vitest";
import {
  PlacementValidator,
  OccupantType,
} from "../../generators/PlacementValidator";

describe("PlacementValidator", () => {
  it("should start with no occupied cells", () => {
    const validator = new PlacementValidator();
    expect(validator.getOccupiedCells()).toHaveLength(0);
  });

  it("should allow occupying an empty cell", () => {
    const validator = new PlacementValidator();
    const pos = { x: 5, y: 5 };
    const success = validator.occupy(pos, OccupantType.SquadSpawn);

    expect(success).toBe(true);
    expect(validator.isCellOccupied(pos)).toBe(true);
    expect(validator.getOccupantType(pos)).toBe(OccupantType.SquadSpawn);
    expect(validator.getOccupiedCells()).toHaveLength(1);
  });

  it("should reject occupying an already occupied cell", () => {
    const validator = new PlacementValidator();
    const pos = { x: 5, y: 5 };
    validator.occupy(pos, OccupantType.SquadSpawn);

    const success = validator.occupy(pos, OccupantType.EnemySpawn);
    expect(success).toBe(false);
    expect(validator.getOccupantType(pos)).toBe(OccupantType.SquadSpawn);
  });

  it("should allow occupying different cells", () => {
    const validator = new PlacementValidator();
    validator.occupy({ x: 1, y: 1 }, OccupantType.SquadSpawn);
    validator.occupy({ x: 2, y: 2 }, OccupantType.EnemySpawn);
    validator.occupy({ x: 3, y: 3 }, OccupantType.Extraction);
    validator.occupy({ x: 4, y: 4 }, OccupantType.Objective);

    expect(validator.getOccupiedCells()).toHaveLength(4);
  });

  it("should correctly release a cell", () => {
    const validator = new PlacementValidator();
    const pos = { x: 5, y: 5 };
    validator.occupy(pos, OccupantType.SquadSpawn);
    expect(validator.isCellOccupied(pos)).toBe(true);

    validator.release(pos);
    expect(validator.isCellOccupied(pos)).toBe(false);
    expect(validator.getOccupiedCells()).toHaveLength(0);
  });

  it("should correctly clear all cells", () => {
    const validator = new PlacementValidator();
    validator.occupy({ x: 1, y: 1 }, OccupantType.SquadSpawn);
    validator.occupy({ x: 2, y: 2 }, OccupantType.EnemySpawn);

    validator.clear();
    expect(validator.getOccupiedCells()).toHaveLength(0);
    expect(validator.isCellOccupied({ x: 1, y: 1 })).toBe(false);
  });
});
