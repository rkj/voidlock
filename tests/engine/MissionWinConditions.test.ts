import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MissionType,
  UnitState,
  CellType,
  MapDefinition,
  SquadConfig,
  GameState,
  Unit,
  Objective,
} from "@src/shared/types";

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

  const getInternalState = (engine: CoreEngine): GameState =>
    (engine as any).state;

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

      // Manually complete ALL objectives
      getInternalState(engine).objectives.forEach(
        (o: Objective) => (o.state = "Completed"),
      );

      engine.update(100);
      expect(engine.getState().status).toBe("Won");

      // Wipe squad
      getInternalState(engine).units.forEach((u: Unit) => (u.hp = 0));
      engine.update(100);

      // Should remain "Won"
      expect(engine.getState().status).toBe("Won");
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

      // Find hive objective
      const hiveObj = getInternalState(engine).objectives.find(
        (o: Objective) => o.kind === "Kill",
      );
      expect(hiveObj).toBeDefined();

      // Manually complete objective (kill hive)
      if (hiveObj) hiveObj.state = "Completed";

      engine.update(100);
      expect(engine.getState().status).toBe("Won");

      // Wipe squad
      getInternalState(engine).units.forEach((u: Unit) => (u.hp = 0));
      engine.update(100);

      // Should remain "Won"
      expect(engine.getState().status).toBe("Won");
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

      // Wipe squad
      getInternalState(engine).units.forEach((u: Unit) => (u.hp = 0));
      engine.update(100);

      expect(engine.getState().status).toBe("Lost");
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

      // 1. Pickup ALL artifacts
      getInternalState(engine).objectives.forEach(
        (o: Objective) => (o.state = "Completed"),
      );
      getInternalState(engine).units[0].carriedObjectiveId =
        getInternalState(engine).objectives[0].id;

      engine.update(100);
      expect(engine.getState().status).toBe("Playing"); // Still playing, need to extract

      // 2. One unit extracts
      getInternalState(engine).units[0].state = UnitState.Extracted;
      // Other unit still active
      engine.update(100);
      expect(engine.getState().status).toBe("Playing");

      // 3. Other unit extracts
      getInternalState(engine).units[1].state = UnitState.Extracted;
      engine.update(100);
      expect(engine.getState().status).toBe("Won");
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

      // 1. All objectives completed (Unit 0 picks up artifact 0)
      getInternalState(engine).objectives.forEach(
        (o: Objective) => (o.state = "Completed"),
      );
      getInternalState(engine).units[0].carriedObjectiveId =
        getInternalState(engine).objectives[0].id;

      engine.update(100);

      // 2. Unit 0 dies (drops artifact 0)
      getInternalState(engine).units[0].hp = 0;
      engine.update(100); // CoreEngine handles death and resets objective to Pending

      expect(getInternalState(engine).objectives[0].state).toBe("Pending");

      // 3. Unit 1 extracts
      getInternalState(engine).units[1].state = UnitState.Extracted;
      engine.update(100);

      // Active units = 0, but artifact 0 is Pending -> Lost
      expect(engine.getState().status).toBe("Lost");
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

      // Soldier dies
      getInternalState(engine).units.find(
        (u: Unit) => u.archetypeId !== "vip",
      )!.hp = 0;
      engine.update(100);
      expect(engine.getState().status).toBe("Playing");

      // VIP extracts
      getInternalState(engine).units.find(
        (u: Unit) => u.archetypeId === "vip",
      )!.state = UnitState.Extracted;
      engine.update(100);
      expect(engine.getState().status).toBe("Won");
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

      getInternalState(engine).units.find(
        (u: Unit) => u.archetypeId === "vip",
      )!.hp = 0;
      engine.update(100);
      expect(engine.getState().status).toBe("Lost");
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

      const combatUnits = getInternalState(engine).units.filter(
        (u: Unit) => u.archetypeId !== "vip",
      );
      combatUnits.forEach((u: Unit) => (u.hp = 0));

      engine.update(100);
      expect(engine.getState().status).toBe("Lost");
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

      // No objectives in Default by default (unless map has them)
      expect(engine.getState().objectives.length).toBe(0);

      getInternalState(engine).units.forEach(
        (u: Unit) => (u.state = UnitState.Extracted),
      );
      engine.update(100);
      expect(engine.getState().status).toBe("Won");
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

      getInternalState(engine).units.forEach((u: Unit) => (u.hp = 0));
      engine.update(100);
      expect(engine.getState().status).toBe("Lost");
    });
  });
});
