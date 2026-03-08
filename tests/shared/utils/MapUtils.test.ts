import { describe, it, expect } from "vitest";
import { MapUtils } from "@src/shared/utils/MapUtils";
import { MapDefinition, Objective, Enemy } from "@src/shared/types";
import { CENTER_OFFSET } from "@src/shared/constants";

describe("MapUtils", () => {
  describe("isValidSpawnPoint", () => {
    it("should return true if cell is in squadSpawns", () => {
      const map: Partial<MapDefinition> = {
        squadSpawns: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      };
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 1, y: 1 })).toBe(true);
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 2, y: 2 })).toBe(true);
    });

    it("should return true if cell matches squadSpawn", () => {
      const map: Partial<MapDefinition> = {
        squadSpawn: { x: 5, y: 5 },
      };
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 5, y: 5 })).toBe(true);
    });

    it("should return false if cell is not a spawn point", () => {
      const map: Partial<MapDefinition> = {
        squadSpawns: [{ x: 1, y: 1 }],
        squadSpawn: { x: 5, y: 5 },
      };
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 2, y: 2 })).toBe(false);
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 6, y: 6 })).toBe(false);
    });

    it("should handle fractional coordinates in input cell", () => {
      const map: Partial<MapDefinition> = {
        squadSpawns: [{ x: 1, y: 1 }],
      };
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 1.5, y: 1.5 })).toBe(true);
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 0.9, y: 1.1 })).toBe(false);
    });

    it("should handle fractional coordinates in spawn points", () => {
      const map: Partial<MapDefinition> = {
        squadSpawns: [{ x: 1.5, y: 1.5 }],
      };
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 1.0, y: 1.0 })).toBe(true);
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 1.9, y: 1.9 })).toBe(true);
    });

    it("should handle undefined squadSpawns and squadSpawn", () => {
      const map: Partial<MapDefinition> = {};
      expect(MapUtils.isValidSpawnPoint(map as MapDefinition, { x: 1, y: 1 })).toBe(false);
    });
  });

  describe("getSquadSpawns", () => {
    it("should return squadSpawns if present", () => {
      const map: Partial<MapDefinition> = {
        squadSpawns: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      };
      expect(MapUtils.getSquadSpawns(map as MapDefinition)).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    });

    it("should return squadSpawn as array if squadSpawns is missing", () => {
      const map: Partial<MapDefinition> = {
        squadSpawn: { x: 5, y: 5 },
      };
      expect(MapUtils.getSquadSpawns(map as MapDefinition)).toEqual([{ x: 5, y: 5 }]);
    });

    it("should return empty array if both are missing", () => {
      const map: Partial<MapDefinition> = {};
      expect(MapUtils.getSquadSpawns(map as MapDefinition)).toEqual([]);
    });

    it("should prefer squadSpawns (even if empty) over squadSpawn", () => {
      const map: Partial<MapDefinition> = {
        squadSpawns: [],
        squadSpawn: { x: 5, y: 5 },
      };
      expect(MapUtils.getSquadSpawns(map as MapDefinition)).toEqual([]);
    });
  });

  describe("resolveObjectivePosition", () => {
    it("should resolve position from targetCell", () => {
      const obj: Partial<Objective> = {
        targetCell: { x: 10, y: 10 },
      };
      const pos = MapUtils.resolveObjectivePosition(obj as Objective, []);
      expect(pos).toEqual({ x: 10 + CENTER_OFFSET, y: 10 + CENTER_OFFSET });
    });

    it("should resolve position from targetEnemyId", () => {
      const obj: Partial<Objective> = {
        targetEnemyId: "enemy-1",
      };
      const enemies: Partial<Enemy>[] = [
        { id: "enemy-1", pos: { x: 12.5, y: 15.5 } },
      ];
      const pos = MapUtils.resolveObjectivePosition(obj as Objective, enemies as Enemy[]);
      expect(pos).toEqual({ x: 12.5, y: 15.5 });
    });

    it("should return default offset if neither targetCell nor targetEnemyId found", () => {
      const obj: Partial<Objective> = {
        targetEnemyId: "enemy-2",
      };
      const enemies: Partial<Enemy>[] = [
        { id: "enemy-1", pos: { x: 12.5, y: 15.5 } },
      ];
      const pos = MapUtils.resolveObjectivePosition(obj as Objective, enemies as Enemy[]);
      expect(pos).toEqual({ x: CENTER_OFFSET, y: CENTER_OFFSET });
    });

    it("should prioritize targetCell over targetEnemyId", () => {
      const obj: Partial<Objective> = {
        targetCell: { x: 10, y: 10 },
        targetEnemyId: "enemy-1",
      };
      const enemies: Partial<Enemy>[] = [
        { id: "enemy-1", pos: { x: 12.5, y: 15.5 } },
      ];
      const pos = MapUtils.resolveObjectivePosition(obj as Objective, enemies as Enemy[]);
      expect(pos).toEqual({ x: 10 + CENTER_OFFSET, y: 10 + CENTER_OFFSET });
    });
  });
});
