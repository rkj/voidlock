import { describe, it, expect } from "vitest";
import { TimeUtility } from "@src/renderer/TimeUtility";

describe("Regression voidlock-sstg.3: formatSpeed", () => {
  it("should return '0.05x (Active Pause)' when scale is 0.05 and paused", () => {
    expect(TimeUtility.formatSpeed(0.05, true)).toBe("0.05x (Active Pause)");
  });

  it("should return '0.0x (Paused)' when scale is 0 and paused", () => {
    expect(TimeUtility.formatSpeed(0, true)).toBe("0.0x (Paused)");
  });

  it("should return regular formatting when not paused", () => {
    expect(TimeUtility.formatSpeed(1.0, false)).toBe("1.0x");
    expect(TimeUtility.formatSpeed(0.1, false)).toBe("0.1x");
  });
});
