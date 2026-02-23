import { describe, it, expect } from "vitest";
import { SquadSoldierConfigSchema } from "@src/shared/schemas/units";
import { SquadSoldierConfig } from "@src/shared/types";

describe("Regression voidlock-2ab9n: SquadSoldierConfig status", () => {
  it("should validate SquadSoldierConfig with status using SquadSoldierConfigSchema", () => {
    const config: SquadSoldierConfig = {
      archetypeId: "assault",
      status: "Wounded",
    };

    const result = SquadSoldierConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("Wounded");
    }
  });

  it("should allow all valid status values", () => {
    const statuses: ("Healthy" | "Wounded" | "Dead")[] = ["Healthy", "Wounded", "Dead"];
    
    for (const status of statuses) {
      const config: SquadSoldierConfig = {
        archetypeId: "assault",
        status,
      };
      const result = SquadSoldierConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    }
  });

  it("should fail validation for invalid status values", () => {
    const config = {
      archetypeId: "assault",
      status: "InvalidStatus",
    };

    const result = SquadSoldierConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should allow missing status (optional)", () => {
    const config: SquadSoldierConfig = {
      archetypeId: "assault",
    };

    const result = SquadSoldierConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeUndefined();
    }
  });
});
