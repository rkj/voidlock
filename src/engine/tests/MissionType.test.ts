import { describe, it, expect } from "vitest";
import { MissionType } from "../../shared/types";

describe("MissionType Enum", () => {
  it("should contain RecoverIntel", () => {
    expect(MissionType.RecoverIntel).toBe("RecoverIntel");
  });
});
