import { GameState, Door, UnitState, BoundaryType } from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { MathUtils } from "../../shared/utils/MathUtils";

export class DoorManager {
  private doors: Map<string, Door>;

  constructor(
    mapDoors: Door[] = [],
    private gameGrid: GameGrid,
  ) {
    this.doors = new Map(mapDoors.map((door) => [door.id, door]));
    this.doors.forEach((door) => this.updateDoorBoundary(door));
  }

  public getDoors(): Map<string, Door> {
    return this.doors;
  }

  public update(state: GameState, dt: number) {
    for (const [id, door] of this.doors.entries()) {
      if (door.state === "Destroyed") continue;

      let newDoor = door;

      if (door.openTimer !== undefined && door.openTimer > 0) {
        const nextTimer = door.openTimer - dt;
        if (nextTimer <= 0) {
          newDoor = {
            ...door,
            state: door.targetState!,
            openTimer: undefined,
            targetState: undefined,
          };
          this.updateDoorBoundary(newDoor);
        } else {
          newDoor = {
            ...door,
            openTimer: nextTimer,
          };
        }
        this.doors.set(id, newDoor);
        continue;
      }

      const unitAdjacent = this.isUnitAdjacentToDoor(door, state);
      const soldierAdjacent = this.isSoldierAdjacentToDoor(door, state);

      if (unitAdjacent) {
        if (
          door.state === "Closed" ||
          (door.state === "Locked" && soldierAdjacent)
        ) {
          newDoor = {
            ...door,
            targetState: "Open",
            openTimer: door.openDuration * 1000,
          };
          this.updateDoorBoundary(newDoor);
          this.doors.set(id, newDoor);
        }
      } else {
        if (door.state === "Open") {
          newDoor = {
            ...door,
            targetState: "Closed",
            openTimer: door.openDuration * 1000,
          };
          this.updateDoorBoundary(newDoor);
          this.doors.set(id, newDoor);
        }
      }
    }
  }

  public updateDoorBoundary(door: Door) {
    const graph = this.gameGrid.getGraph();
    if (door.segment.length === 2) {
      const c1 = door.segment[0];
      const c2 = door.segment[1];
      const boundary = graph.getBoundary(c1.x, c1.y, c2.x, c2.y);
      if (boundary) {
        const isPassable =
          door.state === "Open" ||
          door.state === "Destroyed" ||
          door.targetState === "Open";

        // We still mutate boundary.type here because Graph is a complex internal structure
        // that isn't easily made immutable without a large refactor.
        // But for structural sharing of GameState, we've improved Door objects.
        boundary.type = isPassable ? BoundaryType.Open : BoundaryType.Door;
      }
    }
  }

  private isUnitAdjacentToDoor(door: Door, state: GameState): boolean {
    const adjacentCells = door.segment;
    for (const adjCell of adjacentCells) {
      if (
        state.units.some(
          (unit) =>
            unit.state !== UnitState.Dead &&
            unit.state !== UnitState.Extracted &&
            MathUtils.sameCellPosition(unit.pos, adjCell),
        )
      ) {
        return true;
      }
      if (
        state.enemies.some(
          (enemy) =>
            enemy.hp > 0 && MathUtils.sameCellPosition(enemy.pos, adjCell),
        )
      ) {
        return true;
      }
    }
    return false;
  }

  private isSoldierAdjacentToDoor(door: Door, state: GameState): boolean {
    const adjacentCells = door.segment;
    for (const adjCell of adjacentCells) {
      if (
        state.units.some(
          (unit) =>
            unit.state !== UnitState.Dead &&
            unit.state !== UnitState.Extracted &&
            MathUtils.sameCellPosition(unit.pos, adjCell),
        )
      ) {
        return true;
      }
    }
    return false;
  }
}
