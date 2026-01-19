import { describe, it, expect } from "vitest";
import { LineOfSight } from "@src/engine/LineOfSight";
import { GameGrid } from "@src/engine/GameGrid";
import { MapDefinition, CellType, Door, Cell } from "@src/shared/types";

describe("LineOfSight Precision (ADR 0026)", () => {
  const createTestMapWithDoor = (
    doorState: "Open" | "Closed" | "Locked" | "Destroyed",
  ): { map: MapDefinition; doors: Map<string, Door> } => {
    const doorId = "testDoor";
    const mapCells: Cell[] = [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
    ];

    const door: Door = {
      id: doorId,
      segment: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      orientation: "Vertical",
      state: doorState,
      hp: 100,
      maxHp: 100,
      openDuration: 1,
    };

    const doorsMap = new Map<string, Door>();
    doorsMap.set(doorId, door);

    return {
      map: { 
        width: 2, 
        height: 1, 
        cells: mapCells, 
        doors: [door],
        boundaries: [
          { x1: 0, y1: 0, x2: 1, y2: 0, type: "Door" as any, doorId }
        ]
      },
      doors: doorsMap,
    };
  };

  describe("Door Struts", () => {
    it("should block LOF through an open door if rays hit struts (outer 1/3)", () => {
      const { map, doors } = createTestMapWithDoor("Open");
      const grid = new GameGrid(map);
      const los = new LineOfSight(grid.getGraph(), doors);

      // Center ray passes through the gap (0.33 to 0.66)
      // Perpendicular offsets (+/- 0.3) will hit the struts (0 to 0.33 and 0.66 to 1.0)
      // For a horizontal shot at y=0.5:
      // Center: y=0.5 (Pass)
      // Offset 1: y=0.5 - 0.3 = 0.2 (Hit Strut -> Block)
      // Offset 2: y=0.5 + 0.3 = 0.8 (Hit Strut -> Block)
      // LOF requires ALL rays to pass.
      
      const start = { x: 0.5, y: 0.5 };
      const end = { x: 1.5, y: 0.5 };
      
      // This test is expected to FAIL until ADR 0026 is implemented
      expect(los.hasLineOfFire(start, end)).toBe(false);
    });

    it("should allow LOS through an open door even if some rays hit struts", () => {
      const { map, doors } = createTestMapWithDoor("Open");
      const grid = new GameGrid(map);
      const los = new LineOfSight(grid.getGraph(), doors);

      // LOS requires ANY ray to pass.
      // Center ray passes (0.5), so LOS should be true.
      
      const start = { x: 0.5, y: 0.5 };
      const end = { x: 1.5, y: 0.5 };
      
      expect(los.hasLineOfSight(start, end)).toBe(true);
    });

    it("should block both LOS and LOF if the center ray also hits a strut", () => {
        const { map, doors } = createTestMapWithDoor("Open");
        const grid = new GameGrid(map);
        const los = new LineOfSight(grid.getGraph(), doors);
  
        // Shot at y=0.1
        // Center: y=0.1 (Hit Strut -> Block)
        // Offset 1: y=0.1 - 0.3 = -0.2 (Out of bounds/Hit Wall -> Block)
        // Offset 2: y=0.1 + 0.3 = 0.4 (Pass through gap)
        
        const start = { x: 0.5, y: 0.1 };
        const end = { x: 1.5, y: 0.1 };
        
        // LOS should still be TRUE because Offset 2 passes!
        // Wait, if ANY ray passes, LOS is true.
        expect(los.hasLineOfSight(start, end)).toBe(true);

        // LOF should be FALSE because Center and Offset 1 are blocked.
        expect(los.hasLineOfFire(start, end)).toBe(false);
    });
  });

  describe("Corner Buffering (Unit Radius)", () => {
    it("should block LOF if the unit radius clips a wall corner", () => {
      // 2x2 map
      // F V
      // F F
      const cells = [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Void },
        { x: 0, y: 1, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
      ];
      const map: MapDefinition = {
        width: 2,
        height: 2,
        cells,
      };
      const grid = new GameGrid(map);
      const los = new LineOfSight(grid.getGraph(), new Map());

      // Try to shoot from (0.5, 0.5) to (1.5, 1.5)
      // This is diagonal. 
      // The corner of the Void cell (1,0) is at (1.0, 1.0).
      // The ray passes through (1.0, 1.0).
      
      const start = { x: 0.5, y: 0.5 };
      const end = { x: 1.5, y: 1.5 };
      
      // Center ray hits the exact corner. In most grid raycasters, 
      // hitting a corner exactly might be ambiguous or pass.
      // But with Unit Radius, it should definitely be blocked.
      expect(los.hasLineOfFire(start, end)).toBe(false);
    });

    it("should block LOF if the ray passes within UNIT_RADIUS of a convex corner", () => {
        // F F F
        // F F V (Void at 2,1)
        // F F F
        const cells = [
            { x: 0, y: 0, type: CellType.Floor }, { x: 1, y: 0, type: CellType.Floor }, { x: 2, y: 0, type: CellType.Floor },
            { x: 0, y: 1, type: CellType.Floor }, { x: 1, y: 1, type: CellType.Floor }, { x: 2, y: 1, type: CellType.Void },
            { x: 0, y: 2, type: CellType.Floor }, { x: 1, y: 2, type: CellType.Floor }, { x: 2, y: 2, type: CellType.Floor },
        ];
        const map: MapDefinition = {
            width: 3,
            height: 3,
            cells,
        };
        const grid = new GameGrid(map);
        const los = new LineOfSight(grid.getGraph(), new Map());

        // Vertical shot at x=1.8 from y=0.5 to y=2.5
        // It passes through cells (1,0), (1,1), (1,2). All Floor.
        // It passes boundaries at y=1 and y=2.
        // At y=1, x=1.8: boundary between (1,0) and (1,1). Both Floor. Open.
        // At y=2, x=1.8: boundary between (1,1) and (1,2). Both Floor. Open.
        // HOWEVER, it passes within 0.2 of the corner (2,1) which is Void.
        // Distance from (2.0, 1.0) to ray x=1.8 is 0.2.
        // 0.2 < 0.3 (UNIT_RADIUS).
        
        const start = { x: 1.8, y: 0.5 };
        const end = { x: 1.8, y: 2.5 };
        
        expect(los.hasLineOfFire(start, end)).toBe(false);
    });

    it("should block LOF if a 'fat' ray hits a wall even if the center ray is clear", () => {
        // F F
        // F V
        const cells = [
            { x: 0, y: 0, type: CellType.Floor },
            { x: 1, y: 0, type: CellType.Floor },
            { x: 0, y: 1, type: CellType.Floor },
            { x: 1, y: 1, type: CellType.Void },
        ];
        const map: MapDefinition = {
            width: 2,
            height: 2,
            cells,
        };
        const grid = new GameGrid(map);
        const los = new LineOfSight(grid.getGraph(), new Map());

        // Horizontal shot from (0.5, 0.6) to (1.5, 0.6)
        // Center ray: y=0.6. Passes through boundary between (0,0) and (1,0). Clear.
        // Offset 2: y=0.6 + 0.3 = 0.9. Passes through boundary between (0,1) and (1,1).
        // Cell (1,1) is Void, so (0,1)-(1,1) boundary is a Wall.
        // So Offset 2 is blocked.
        // LOF should be blocked.
        
        const start = { x: 0.5, y: 0.6 };
        const end = { x: 1.5, y: 0.6 };
        
        expect(los.hasLineOfFire(start, end)).toBe(false);
        
        // LOS should be clear because center ray is clear.
        expect(los.hasLineOfSight(start, end)).toBe(true);
    });
  });
});
