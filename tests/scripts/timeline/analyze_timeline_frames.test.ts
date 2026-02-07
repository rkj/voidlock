import { describe, expect, it } from "vitest";
import { chooseCompositeMode } from "../../../scripts/timeline/analyze_timeline_frames";

describe("timeline frame composition mode", () => {
  it("uses 1-up layout when only one screen is available", () => {
    expect(chooseCompositeMode(1)).toBe(1);
  });

  it("uses 2-up layout when two screens are available", () => {
    expect(chooseCompositeMode(2)).toBe(2);
  });

  it("uses 4-up layout when three or more screens are available", () => {
    expect(chooseCompositeMode(3)).toBe(4);
    expect(chooseCompositeMode(4)).toBe(4);
    expect(chooseCompositeMode(99)).toBe(4);
  });
});
