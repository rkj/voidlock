import { describe, it, expect } from "vitest";
import { MapDefinitionSchema } from "@src/shared/schemas/map";

describe("MapDefinitionSchema", () => {
  const validMap = {
    width: 10,
    height: 10,
    cells: [
      { x: 0, y: 0, type: "Floor" },
      { x: 1, y: 0, type: "Floor" },
    ],
    spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 1 }],
  };

  it("should validate a valid map definition", () => {
    const result = MapDefinitionSchema.safeParse(validMap);
    if (!result.success) {
      console.log(JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });

  it("should reject a map with invalid dimensions", () => {
    const invalidMap = { ...validMap, width: 5 }; // min is 6
    const result = MapDefinitionSchema.safeParse(invalidMap);
    expect(result.success).toBe(false);
  });

  it("should reject a map with invalid cell type", () => {
    const invalidMap = {
      ...validMap,
      cells: [{ x: 0, y: 0, type: "InvalidType" }],
    };
    const result = MapDefinitionSchema.safeParse(invalidMap);
    expect(result.success).toBe(false);
  });

  it("should reject a map missing required fields", () => {
    const invalidMap = { width: 10 };
    const result = MapDefinitionSchema.safeParse(invalidMap);
    expect(result.success).toBe(false);
  });
});
