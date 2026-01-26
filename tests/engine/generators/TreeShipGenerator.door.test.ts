import { describe, it } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { MapDefinition, CellType } from "@src/shared/types";

describe("TreeShipGenerator Door Validation", () => {
  const checkDoors = (map: MapDefinition) => {
    map.doors?.forEach((door) => {
      if (door.segment.length !== 2) {
        throw new Error(
          `Door ${door.id} should have exactly 2 segments, has ${door.segment.length}`,
        );
      }

      const c1Pos = door.segment[0];
      const c2Pos = door.segment[1];

      const c1 = map.cells.find((c) => c.x === c1Pos.x && c.y === c1Pos.y);
      const c2 = map.cells.find((c) => c.x === c2Pos.x && c.y === c2Pos.y);

      // Both must exist and be Floor
      if (
        !c1 ||
        c1.type !== CellType.Floor ||
        !c2 ||
        c2.type !== CellType.Floor
      ) {
        throw new Error(
          `Door ${door.id} between (${c1Pos.x},${c1Pos.y}) and (${c2Pos.x},${c2Pos.y}) connects to invalid/void cell. C1: ${c1?.type}, C2: ${c2?.type}`,
        );
      }
    });
  };

  it("should only place doors between two floor cells (100 iterations)", () => {
    for (let i = 0; i < 100; i++) {
      const generator = new TreeShipGenerator(i, 16, 16);
      const map = generator.generate();
      checkDoors(map);
    }
  });
});
