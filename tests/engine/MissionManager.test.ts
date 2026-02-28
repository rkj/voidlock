import { describe, it, expect, beforeEach } from "vitest";
import { MissionManager } from "@src/engine/managers/MissionManager";
import {
  MissionType,
  GameState,
  UnitState,
  Cell,
  CellType,
  EnemyType,
} from "@src/shared/types";
import { PRNG } from "@src/shared/PRNG";
import {
  createMockGameState,
  createMockUnit,
} from "@src/engine/tests/utils/MockFactory";
import { EnemyManager } from "@src/engine/managers/EnemyManager";

describe("MissionManager", () => {
  let missionManager: MissionManager;
  let prng: PRNG;
  let state: GameState;
  let enemyManager: EnemyManager;

  beforeEach(() => {
    prng = new PRNG(12345);
    state = createMockGameState();
    // EnemyManager needs some dependencies but for MissionManager setup we might just need a mock or simple instance
    enemyManager = new EnemyManager();
  });

  describe("setupMission", () => {
    it("should setup RecoverIntel mission with 3 objectives", () => {
      missionManager = new MissionManager(MissionType.RecoverIntel, prng);
      const map = {
        width: 20,
        height: 20,
        cells: [] as Cell[],
        extraction: { x: 0, y: 0 },
      };
      // Fill map with floors
      for (let x = 0; x < 20; x++) {
        for (let y = 0; y < 20; y++) {
          map.cells.push({ x, y, type: CellType.Floor });
        }
      }

      missionManager.setupMission(state, map, enemyManager);

      const recoverObjectives = state.objectives.filter(
        (o) => o.kind === "Recover",
      );
      expect(recoverObjectives.length).toBe(3);
      expect(state.objectives.every((o) => o.state === "Pending")).toBe(true);
    });

    it("should setup DestroyHive mission", () => {
      missionManager = new MissionManager(MissionType.DestroyHive, prng);
      const map = {
        width: 20,
        height: 20,
        cells: [] as Cell[],
        extraction: { x: 0, y: 0 },
      };
      // Fill map with floors and rooms
      for (let x = 0; x < 20; x++) {
        for (let y = 0; y < 20; y++) {
          map.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
        }
      }

      missionManager.setupMission(state, map, enemyManager);

      expect(state.enemies.some((e) => e.type === EnemyType.Hive)).toBe(true);
      expect(state.objectives.some((o) => o.kind === "Kill")).toBe(true);
    });
  });

  describe("checkWinLoss", () => {
    it("should win RecoverIntel if all objectives completed and units extracted", () => {
      missionManager = new MissionManager(MissionType.RecoverIntel, prng);
      state.objectives = [
        { id: "1", kind: "Recover", state: "Completed" },
        { id: "2", kind: "Recover", state: "Completed" },
        { id: "3", kind: "Recover", state: "Completed" },
      ];
      state.units = [createMockUnit({ state: UnitState.Extracted })];

      missionManager.checkWinLoss(state);
      expect(state.status).toBe("Won");
    });

    it("should win RecoverIntel if all objectives completed even if squad wiped", () => {
      missionManager = new MissionManager(MissionType.RecoverIntel, prng);
      state.objectives = [{ id: "1", kind: "Recover", state: "Completed" }];
      state.units = [createMockUnit({ state: UnitState.Dead })];

      missionManager.checkWinLoss(state);
      expect(state.status).toBe("Won");
    });

    it("should win DestroyHive if Hive killed and units extracted", () => {
      missionManager = new MissionManager(MissionType.DestroyHive, prng);
      state.objectives = [{ id: "obj-hive", kind: "Kill", state: "Completed" }];
      state.units = [createMockUnit({ state: UnitState.Extracted })];

      missionManager.checkWinLoss(state);
      expect(state.status).toBe("Won");
    });

    it("should win ExtractArtifacts if artifact recovered and unit extracted", () => {
      missionManager = new MissionManager(MissionType.ExtractArtifacts, prng);
      state.objectives = [{ id: "obj-1", kind: "Recover", state: "Completed" }];
      state.units = [createMockUnit({ id: "u1", state: UnitState.Extracted })];

      missionManager.checkWinLoss(state);
      expect(state.status).toBe("Won");
    });

    it("should lose ExtractArtifacts if artifact recovered but no one extracted", () => {
      missionManager = new MissionManager(MissionType.ExtractArtifacts, prng);
      state.objectives = [{ id: "obj-1", kind: "Recover", state: "Completed" }];
      state.units = [createMockUnit({ id: "u1", state: UnitState.Dead })];

      missionManager.checkWinLoss(state);
      expect(state.status).toBe("Lost");
    });

    it("should win Default mission if no objectives and unit extracted", () => {
      missionManager = new MissionManager(MissionType.Default, prng);
      state.objectives = [];
      state.units = [createMockUnit({ id: "u1", state: UnitState.Extracted })];

      missionManager.checkWinLoss(state);
      expect(state.status).toBe("Won");
    });
  });
});
