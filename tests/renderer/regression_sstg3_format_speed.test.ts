import { describe, it, expect, beforeEach } from "vitest";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { setLocale } from "@src/renderer/i18n";

describe("Regression voidlock-sstg.3: formatSpeed", () => {
  beforeEach(() => {
    setLocale("en-standard");
  });

  it("should return '0.1x (Active Pause)' when scale is 0.1 and paused", () => {
    expect(TimeUtility.formatSpeed(0.1, true)).toBe("0.1x (Active Pause)");
  });

  it("should return '0.0x (Paused)' when scale is 0 and paused", () => {
    expect(TimeUtility.formatSpeed(0, true)).toBe("0.0x (Paused)");
  });

  it("should return normal format when not paused", () => {
    expect(TimeUtility.formatSpeed(1.0, false)).toBe("1.0x");
    expect(TimeUtility.formatSpeed(2.5, false)).toBe("2.5x");
  });
});
