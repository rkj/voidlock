import { Vector2, MapDefinition } from "../../shared/types";

export enum OccupantType {
  SquadSpawn = "SquadSpawn",
  EnemySpawn = "EnemySpawn",
  Extraction = "Extraction",
  Objective = "Objective",
  Loot = "Loot",
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
   * Creates a PlacementValidator populated with existing occupants from a map definition.
   */
  public static fromMap(map: MapDefinition): PlacementValidator {
    const validator = new PlacementValidator();

    const getRoomId = (pos: Vector2) => {
      return map.cells.find((c) => c.x === pos.x && c.y === pos.y)?.roomId;
    };

    if (map.squadSpawn)
      validator.occupy(
        map.squadSpawn,
        OccupantType.SquadSpawn,
        getRoomId(map.squadSpawn),
      );
    if (map.squadSpawns)
      map.squadSpawns.forEach((s) =>
        validator.occupy(s, OccupantType.SquadSpawn, getRoomId(s)),
      );
    if (map.extraction)
      validator.occupy(
        map.extraction,
        OccupantType.Extraction,
        getRoomId(map.extraction),
      );
    if (map.spawnPoints)
      map.spawnPoints.forEach((s) =>
        validator.occupy(s.pos, OccupantType.EnemySpawn, getRoomId(s.pos)),
      );
    if (map.objectives)
      map.objectives.forEach((o) => {
        if (o.targetCell)
          validator.occupy(
            o.targetCell,
            OccupantType.Objective,
            getRoomId(o.targetCell),
          );
      });
    if (map.bonusLoot)
      map.bonusLoot.forEach((l) =>
        validator.occupy(l, OccupantType.Loot, getRoomId(l)),
      );

    return validator;
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

    // Corridor Ban: All static entities must be placed in rooms, not corridors.
    if (!roomId || roomId.startsWith("corridor-")) {
      return false;
    }

    if (enforceRoomExclusivity && roomId && this.isRoomOccupied(roomId)) {
      // Allow multiple occupants of the same type in the same room (e.g. multiple squad spawns)
      if (this.occupiedRooms.get(roomId) !== type) {
        // CRITICAL: Even if room exclusivity is violated, we MUST mark the cell as occupied
        // to prevent other entities (like Loot) from overlapping with this specific cell.
        this.occupiedCells.set(this.getCellKey(pos), type);
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
