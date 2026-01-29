import { describe, it, expect } from "vitest";
import { EnemyType } from "@src/shared/types";

describe("EnemyType Naming Convention", () => {
  it("should have hyphenated lowercase values", () => {
    expect(EnemyType.XenoMite).toBe("xeno-mite");
    expect(EnemyType.WarriorDrone).toBe("warrior-drone");
    expect(EnemyType.PraetorianGuard).toBe("praetorian-guard");
    expect(EnemyType.SpitterAcid).toBe("spitter-acid");
    expect(EnemyType.SwarmMelee).toBe("swarm-melee");
    expect(EnemyType.Hive).toBe("hive");
    expect(EnemyType.Boss).toBe("boss");
    expect(EnemyType.AlienScout).toBe("alien-scout");
    expect(EnemyType.Grunt).toBe("grunt");
    expect(EnemyType.Melee).toBe("melee");
  });
});
