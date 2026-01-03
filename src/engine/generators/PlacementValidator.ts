import { Vector2 } from "../../shared/types";

export enum OccupantType {
  SquadSpawn = "SquadSpawn",
  EnemySpawn = "EnemySpawn",
  Extraction = "Extraction",
  Objective = "Objective",
}

/**
 * Enforces strict placement rules: Squad Spawn, Enemy Spawn, Extraction, and Objectives
 * must never occupy the same cell.
 */
export class PlacementValidator {
  private occupiedCells: Map<string, OccupantType> = new Map();
  private occupiedRooms: Map<string, OccupantType> = new Map();

  private getCellKey(pos: Vector2): string {
    return `${pos.x},${pos.y}`;
  }

  /**
   * Checks if a cell is already occupied by a static entity.
   */
  public isCellOccupied(pos: Vector2): boolean {
    return this.occupiedCells.has(this.getCellKey(pos));
  }

  /**
   * Checks if a room is already occupied.
   */
  public isRoomOccupied(roomId: string): boolean {
    if (!roomId || roomId.startsWith("corridor-")) return false;
    return this.occupiedRooms.has(roomId);
  }

  /**
   * Returns the type of occupant in a cell, or undefined if empty.
   */
  public getOccupantType(pos: Vector2): OccupantType | undefined {
    return this.occupiedCells.get(this.getCellKey(pos));
  }

  /**
   * Attempts to occupy a cell and its room with a specific entity type.
   * Returns true if successful, false if the cell or room is already occupied by a DIFFERENT type.
   */
  public occupy(
    pos: Vector2,
    type: OccupantType,
    roomId?: string,
    enforceRoomExclusivity: boolean = true,
  ): boolean {
    if (this.isCellOccupied(pos)) {
      return false;
    }

    if (enforceRoomExclusivity && roomId && this.isRoomOccupied(roomId)) {
      // Allow multiple occupants of the same type in the same room (e.g. multiple squad spawns)
      if (this.occupiedRooms.get(roomId) !== type) {
        return false;
      }
    }

    this.occupiedCells.set(this.getCellKey(pos), type);
    if (roomId && !roomId.startsWith("corridor-")) {
      this.occupiedRooms.set(roomId, type);
    }
    return true;
  }

  /**
   * Removes an occupant from a cell. Note: does not fully release the room.
   */
  public release(pos: Vector2): void {
    this.occupiedCells.delete(this.getCellKey(pos));
  }

  /**
   * Clears all occupied cells and rooms.
   */
  public clear(): void {
    this.occupiedCells.clear();
    this.occupiedRooms.clear();
  }

  /**
   * Returns all occupied cells and their types.
   */
  public getOccupiedCells(): { pos: Vector2; type: OccupantType }[] {
    const result: { pos: Vector2; type: OccupantType }[] = [];
    this.occupiedCells.forEach((type, key) => {
      const [x, y] = key.split(",").map(Number);
      result.push({ pos: { x, y }, type });
    });
    return result;
  }
}
