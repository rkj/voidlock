import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, SquadConfig, EngineMode } from "@src/shared/types";

describe("CoreEngine: allowTacticalPause Clamping", () => {
  const mockMap: MapDefinition = { width: 10, height: 10, cells: [] };
  const squadConfig: SquadConfig = { soldiers: [], inventory: {} };

  it("should clamp timeScale to 1.0 when allowTacticalPause is false", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      true,
      false,
      "Default" as any,
      false,
      0,
      1.0,
      false,
      EngineMode.Simulation,
      [],
      false, // allowTacticalPause = false
    );

    engine.setTimeScale(0.5);
    expect(engine.getState().settings.timeScale).toBe(1.0);
    expect(engine.getState().settings.isSlowMotion).toBe(false);

    engine.setTimeScale(0.0);
    expect(engine.getState().settings.timeScale).toBe(0.0); // Should still allow absolute pause

    engine.setTimeScale(2.0);
    expect(engine.getState().settings.timeScale).toBe(2.0);
  });

  it("should NOT clamp timeScale when allowTacticalPause is true", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      true,
      false,
      "Default" as any,
      false,
      0,
      1.0,
      false,
      EngineMode.Simulation,
      [],
      true, // allowTacticalPause = true
    );

    engine.setTimeScale(0.5);
    expect(engine.getState().settings.timeScale).toBe(0.5);
    expect(engine.getState().settings.isSlowMotion).toBe(true);
  });
});
