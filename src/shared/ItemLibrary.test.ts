import { describe, it, expect } from "vitest";
import { ItemLibrary } from "../shared/types";

describe("ItemLibrary", () => {
  it("should contain artifact_heavy with negative stats", () => {
    const artifact = ItemLibrary["artifact_heavy"];
    expect(artifact).toBeDefined();
    expect(artifact.id).toBe("artifact_heavy");
    expect(artifact.speedBonus).toBeLessThan(0);
    expect(artifact.accuracyBonus).toBeLessThan(0);
  });
});
