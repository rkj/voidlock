import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MissionType,
  UnitState,
  CellType,
  MapDefinition,
  SquadConfig,
} from "../../shared/types";

describe("Mission Win/Loss Conditions", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [{ id: "spawn-1", pos: { x: 1, y: 1 }, radius: 1 }],
    squadSpawn: { x: 1, y: 1 },
    extraction: { x: 9, y: 9 },
    objectives: [],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
    }
  }

  const squadConfig: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }, { archetypeId: "assault" }],
    inventory: {},
  };

  describe("Expendable Crew Missions (Intel/Hive)", () => {
    it("should win RecoverIntel as soon as all objectives are completed, even if squad is wiped later", () => {
      const intelMap: MapDefinition = {
        ...mockMap,
        objectives: [
          { id: "intel-0", kind: "Recover", targetCell: { x: 2, y: 2 } },
        ],
      };
      const engine = new CoreEngine(
        intelMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.RecoverIntel,
      );
      const state = (engine as any).state;

      // Manually complete ALL objectives (RecoverIntel generates 3)
      state.objectives.forEach((o: any) => (o.state = "Completed"));

      engine.update(100);
      expect(state.status).toBe("Won");

      // Wipe squad
      state.units.forEach((u: any) => (u.hp = 0));
      engine.update(100);

      // Should remain "Won"
      expect(state.status).toBe("Won");
    });

    it("should win DestroyHive as soon as Hive is killed, even if squad is wiped later", () => {
      const engine = new CoreEngine(
        mockMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.DestroyHive,
      );
      const state = (engine as any).state;

      // Find hive objective
      const hiveObj = state.objectives.find((o: any) => o.kind === "Kill");
      expect(hiveObj).toBeDefined();

      // Manually complete objective (kill hive)
      hiveObj.state = "Completed";

      engine.update(100);
      expect(state.status).toBe("Won");

      // Wipe squad
      state.units.forEach((u: any) => (u.hp = 0));
      engine.update(100);

      // Should remain "Won"
      expect(state.status).toBe("Won");
    });

    it("should lose if squad is wiped before objectives are completed", () => {
      const intelMap: MapDefinition = {
        ...mockMap,
        objectives: [
          { id: "intel-0", kind: "Recover", targetCell: { x: 2, y: 2 } },
        ],
      };
      const engine = new CoreEngine(
        intelMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.RecoverIntel,
      );
      const state = (engine as any).state;

      // Wipe squad
      state.units.forEach((u: any) => (u.hp = 0));
      engine.update(100);

      expect(state.status).toBe("Lost");
    });
  });

  describe("Must Survive Missions (Artifact/VIP)", () => {
    it("should win ExtractArtifacts only if artifact is picked up AND at least one unit extracts", () => {
      const artifactMap: MapDefinition = {
        ...mockMap,
        objectives: [
          { id: "artifact-0", kind: "Recover", targetCell: { x: 2, y: 2 } },
        ],
      };
      const engine = new CoreEngine(
        artifactMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.ExtractArtifacts,
      );
      const state = (engine as any).state;

      // 1. Pickup ALL artifacts (ExtractArtifacts generates 3)
      state.objectives.forEach((o: any) => (o.state = "Completed"));
      state.units[0].carriedObjectiveId = state.objectives[0].id;

      engine.update(100);
      expect(state.status).toBe("Playing"); // Still playing, need to extract

      // 2. One unit extracts
      state.units[0].state = UnitState.Extracted;
      // Other unit still active
      engine.update(100);
      expect(state.status).toBe("Playing");

      // 3. Other unit extracts
      state.units[1].state = UnitState.Extracted;
      engine.update(100);
      expect(state.status).toBe("Won");
    });

    it("should lose ExtractArtifacts if all units die, even if artifact was picked up", () => {
      const artifactMap: MapDefinition = {
        ...mockMap,
        objectives: [
          { id: "artifact-0", kind: "Recover", targetCell: { x: 2, y: 2 } },
        ],
      };
      const engine = new CoreEngine(
        artifactMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.ExtractArtifacts,
      );
      const state = (engine as any).state;

      // 1. All objectives completed (Unit 0 picks up artifact 0)
      state.objectives.forEach((o: any) => (o.state = "Completed"));
      state.units[0].carriedObjectiveId = state.objectives[0].id;

      engine.update(100);

      // 2. Unit 0 dies (drops artifact 0)
      state.units[0].hp = 0;
      engine.update(100); // CoreEngine handles death and resets objective to Pending

      expect(state.objectives[0].state).toBe("Pending");

      // 3. Unit 1 extracts
      state.units[1].state = UnitState.Extracted;
      engine.update(100);

      // Active units = 0, but artifact 0 is Pending -> Lost
      expect(state.status).toBe("Lost");
    });

    it("should win EscortVIP if VIP extracts, regardless of other casualties", () => {
      const engine = new CoreEngine(
        mockMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.EscortVIP,
      );
      const state = (engine as any).state;

      const vip = state.units.find((u: any) => u.archetypeId === "vip");
      const soldier = state.units.find((u: any) => u.archetypeId !== "vip");

      // Soldier dies
      soldier.hp = 0;
      engine.update(100);
      expect(state.status).toBe("Playing");

      // VIP extracts
      vip.state = UnitState.Extracted;
      engine.update(100);
      expect(state.status).toBe("Won");
    });

    it("should lose EscortVIP immediately if VIP dies", () => {
      const engine = new CoreEngine(
        mockMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.EscortVIP,
      );
      const state = (engine as any).state;

      const vip = state.units.find((u: any) => u.archetypeId === "vip");

      vip.hp = 0;
      engine.update(100);
      expect(state.status).toBe("Lost");
    });

    it("should lose EscortVIP if all combat units die even if VIP is still alive", () => {
      const engine = new CoreEngine(
        mockMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.EscortVIP,
      );
      const state = (engine as any).state;

      const combatUnits = state.units.filter(
        (u: any) => u.archetypeId !== "vip",
      );
      combatUnits.forEach((u: any) => (u.hp = 0));

      engine.update(100);
      expect(state.status).toBe("Lost");
    });

    it("should win Default mission if all units extract (no objectives)", () => {
      const engine = new CoreEngine(
        mockMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.Default,
      );
      const state = (engine as any).state;

      // No objectives in Default by default (unless map has them)
      expect(state.objectives.length).toBe(0);

      state.units.forEach((u: any) => (u.state = UnitState.Extracted));
      engine.update(100);
      expect(state.status).toBe("Won");
    });

    it("should lose Default mission if squad wiped without extraction", () => {
      const engine = new CoreEngine(
        mockMap,
        1,
        squadConfig,
        true,
        false,
        MissionType.Default,
      );
      const state = (engine as any).state;

      state.units.forEach((u: any) => (u.hp = 0));
      engine.update(100);
      expect(state.status).toBe("Lost");
    });
  });
});
