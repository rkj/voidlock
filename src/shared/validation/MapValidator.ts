import { MapDefinition } from "../types/map";
import { Vector2 } from "../types/geometry";

export class MapValidator {
  public static validateMapData(data: unknown): data is MapDefinition {
    if (typeof data !== "object" || data === null) return false;

    const map = data as Record<string, unknown>;

    // Check required fields
    if (typeof map.width !== "number" || map.width < 1 || map.width > 100) {
      return false;
    }
    if (typeof map.height !== "number" || map.height < 1 || map.height > 100) {
      return false;
    }
    if (!Array.isArray(map.cells)) {
      return false;
    }

    // Validate cell structure
    for (const cell of map.cells) {
      if (!this.isValidCell(cell)) {
        return false;
      }
    }

    // Optional fields
    if (map.walls !== undefined) {
      if (
        !Array.isArray(map.walls) ||
        !map.walls.every((w) => this.isValidWall(w))
      ) {
        return false;
      }
    }

    if (map.spawnPoints !== undefined) {
      if (
        !Array.isArray(map.spawnPoints) ||
        !map.spawnPoints.every((s) => this.isValidSpawnPoint(s))
      ) {
        return false;
      }
    }

    if (map.squadSpawn !== undefined && !this.isValidVector2(map.squadSpawn)) {
      return false;
    }

    if (map.extraction !== undefined && !this.isValidVector2(map.extraction)) {
      return false;
    }

    if (map.objectives !== undefined) {
      if (
        !Array.isArray(map.objectives) ||
        !map.objectives.every((o) => this.isValidObjective(o))
      ) {
        return false;
      }
    }

    if (map.bonusLoot !== undefined) {
      if (
        !Array.isArray(map.bonusLoot) ||
        !map.bonusLoot.every((l) => this.isValidVector2(l))
      ) {
        return false;
      }
    }

    return true;
  }

  private static isValidCell(cell: unknown): boolean {
    if (typeof cell !== "object" || cell === null) return false;
    const c = cell as Record<string, unknown>;
    return (
      typeof c.x === "number" &&
      typeof c.y === "number" &&
      (c.type === "Void" || c.type === "Floor")
    );
  }

  private static isValidVector2(vec: unknown): vec is Vector2 {
    if (typeof vec !== "object" || vec === null) return false;
    const v = vec as Record<string, unknown>;
    return typeof v.x === "number" && typeof v.y === "number";
  }

  private static isValidWall(wall: unknown): boolean {
    if (typeof wall !== "object" || wall === null) return false;
    const w = wall as Record<string, unknown>;
    return this.isValidVector2(w.p1) && this.isValidVector2(w.p2);
  }

  private static isValidSpawnPoint(spawn: unknown): boolean {
    if (typeof spawn !== "object" || spawn === null) return false;
    const s = spawn as Record<string, unknown>;
    return (
      typeof s.id === "string" &&
      this.isValidVector2(s.pos) &&
      typeof s.radius === "number"
    );
  }

  private static isValidObjective(obj: unknown): boolean {
    if (typeof obj !== "object" || obj === null) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.id === "string" &&
      (o.kind === "Recover" || o.kind === "Kill" || o.kind === "Escort") &&
      (o.targetCell === undefined || this.isValidVector2(o.targetCell)) &&
      (o.targetEnemyId === undefined || typeof o.targetEnemyId === "string")
    );
  }
}
