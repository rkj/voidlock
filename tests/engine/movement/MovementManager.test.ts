import { describe, it, expect, beforeEach } from "vitest";
import { MovementManager } from "../../../src/engine/managers/MovementManager";
import { GameGrid } from "../../../src/engine/GameGrid";
import {
  Unit,
  UnitState,
  CellType,
  MapDefinition,
  IMovableEntity,
  Door,
  CommandType,
} from "../../../src/shared/types";
import { MathUtils } from "../../../src/shared/utils/MathUtils";

describe("MovementManager", () => {
  let movementManager: MovementManager;
  let gameGrid: GameGrid;
  const doors = new Map<string, Door>();

  const map: MapDefinition = {
    width: 5,
    height: 5,
    cells: Array.from({ length: 5 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => ({ x, y, type: CellType.Floor }))
    ).flat(),
    spawnPoints: [],
    extraction: { x: 4, y: 4 },
    objectives: [],
    doors: [
      {
        id: "d1",
        orientation: "Vertical",
        state: "Closed",
        segment: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        hp: 100,
        maxHp: 100,
        openDuration: 1,
      },
    ],
  };

  beforeEach(() => {
    gameGrid = new GameGrid(map);
    movementManager = new MovementManager(gameGrid);
    doors.clear();
    if (map.doors) {
      map.doors.forEach((d) => doors.set(d.id, d));
    }
  });

  describe("Unit Movement", () => {
    it("should move a unit towards targetPos and reach it", () => {
      // Use cells (1,1) -> (2,1) to avoid the door at (0,0)-(1,0)
      const unit: Unit = {
        id: "u1",
        pos: { x: 1.5, y: 1.5 },
        targetPos: { x: 2.5, y: 1.5 },
        path: [{ x: 2, y: 1 }],
        stats: { speed: 30 } as any,
        state: UnitState.Idle,
        activeCommand: { type: CommandType.MOVE_TO } as any,
      } as any;

      // dt = 1000ms, speed = 30.
      // moveDist = (30 / 30) * 1000 / 1000 = 1.0 tile
      const updatedUnit = movementManager.handleMovement(
        unit,
        unit.stats.speed,
        1000,
        doors
      );

      expect(updatedUnit.pos.x).toBe(2.5);
      expect(updatedUnit.pos.y).toBe(1.5);
      expect(updatedUnit.state).toBe(UnitState.Idle);
      expect(updatedUnit.activeCommand).toBeUndefined();
    });

    it("should set state to Moving when not arrived", () => {
      const unit: Unit = {
        id: "u1",
        pos: { x: 1.5, y: 1.5 },
        targetPos: { x: 2.5, y: 1.5 },
        path: [{ x: 2, y: 1 }],
        stats: { speed: 30 } as any,
        state: UnitState.Idle,
      } as any;

      // moveDist = 0.5 tile.
      const updatedUnit = movementManager.handleMovement(
        unit,
        unit.stats.speed,
        500,
        doors
      );

      expect(updatedUnit.pos.x).toBe(2.0);
      expect(updatedUnit.state).toBe(UnitState.Moving);
    });
  });

  describe("Generic Entity Movement (Enemy)", () => {
    it("should move an IMovableEntity (Enemy) towards targetPos", () => {
      const enemy: IMovableEntity = {
        id: "e1",
        pos: { x: 1.5, y: 1.5 },
        targetPos: { x: 2.5, y: 1.5 },
        path: [{ x: 2, y: 1 }],
      };

      const speed = 30;
      const updatedEnemy = movementManager.handleMovement(
        enemy,
        speed,
        1000,
        doors
      );

      expect(updatedEnemy.pos.x).toBe(2.5);
      expect(updatedEnemy.targetPos).toBeUndefined();
      expect(updatedEnemy.path).toBeUndefined();
    });

    it("should handle multi-step paths for generic entities", () => {
      const enemy: IMovableEntity = {
        id: "e1",
        pos: { x: 1.5, y: 1.5 },
        targetPos: { x: 2.5, y: 1.5 },
        path: [
          { x: 2, y: 1 },
          { x: 3, y: 1 },
        ],
      };

      const speed = 30;
      // Arrives at first point
      const updatedEnemy = movementManager.handleMovement(
        enemy,
        speed,
        1000,
        doors
      );

      expect(updatedEnemy.pos.x).toBe(2.5);
      expect(updatedEnemy.path).toHaveLength(1);
      expect(updatedEnemy.targetPos).toEqual(
        MathUtils.getCellCenter({ x: 3, y: 1 })
      );
    });
  });

  describe("Door Interaction", () => {
    it("should set state to WaitingForDoor if path is blocked", () => {
      // Door is at (0,0)-(1,0). Move from (0.5, 0.5) to (1.5, 0.5)
      const entity: IMovableEntity = {
        id: "e1",
        pos: { x: 0.5, y: 0.5 },
        targetPos: { x: 1.5, y: 0.5 },
        path: [{ x: 1, y: 0 }],
        state: UnitState.Idle,
      };

      // Door is Closed in doors map
      const door = doors.get("d1")!;
      door.state = "Closed";

      const updatedEntity = movementManager.handleMovement(
        entity,
        30,
        1000,
        doors
      );

      expect(updatedEntity.state).toBe(UnitState.WaitingForDoor);
      expect(updatedEntity.pos.x).toBe(0.5); // Didn't move
    });

    it("should allow movement if door is Open", () => {
      const entity: IMovableEntity = {
        id: "e1",
        pos: { x: 0.5, y: 0.5 },
        targetPos: { x: 1.5, y: 0.5 },
        path: [{ x: 1, y: 0 }],
        state: UnitState.Idle,
      };

      // Open the door
      const door = doors.get("d1")!;
      door.state = "Open";

      const updatedEntity = movementManager.handleMovement(
        entity,
        30,
        1000,
        doors
      );

      expect(updatedEntity.state).toBe(UnitState.Idle); // Arrived
      expect(updatedEntity.pos.x).toBe(1.5);
    });
  });
});
