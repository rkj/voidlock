import { describe, it, expect } from "vitest";
import { TimeUtility } from "@src/renderer/TimeUtility";

describe("TimeUtility", () => {
  describe("sliderToScale", () => {
    it("should map 0 to 0.1x", () => {
      expect(TimeUtility.sliderToScale(0)).toBeCloseTo(0.1);
    });

    it("should map 50 to 1.0x", () => {
      expect(TimeUtility.sliderToScale(50)).toBeCloseTo(1.0);
    });

    it("should map 100 to 10.0x", () => {
      expect(TimeUtility.sliderToScale(100)).toBeCloseTo(10.0);
    });

    it("should be logarithmic (25 should be sqrt(0.1) * 1.0 ~ 0.316)", () => {
      // 10 ^ ((25 - 50) / 50) = 10 ^ (-0.5) = 1 / sqrt(10) ~= 0.3162
      expect(TimeUtility.sliderToScale(25)).toBeCloseTo(0.3162, 4);
    });

    it("should be logarithmic (75 should be sqrt(10) * 1.0 ~ 3.1623)", () => {
      // 10 ^ ((75 - 50) / 50) = 10 ^ (0.5) = sqrt(10) ~= 3.162277
      expect(TimeUtility.sliderToScale(75)).toBeCloseTo(3.16228, 4);
    });
  });

  describe("scaleToSlider", () => {
    it("should map 0.1x to 0", () => {
      expect(TimeUtility.scaleToSlider(0.1)).toBeCloseTo(0);
    });

    it("should map 1.0x to 50", () => {
      expect(TimeUtility.scaleToSlider(1.0)).toBeCloseTo(50);
    });

    it("should map 10.0x to 100", () => {
      expect(TimeUtility.scaleToSlider(10.0)).toBeCloseTo(100);
    });

    it("should map 0.3162x to ~25", () => {
      expect(TimeUtility.scaleToSlider(0.3162277)).toBeCloseTo(25);
    });

    it("should map 3.1622x to ~75", () => {
      expect(TimeUtility.scaleToSlider(3.162277)).toBeCloseTo(75);
    });
  });

  describe("Round-trip", () => {
    it("should maintain value through both conversions", () => {
      for (let i = 0; i <= 100; i += 10) {
        const scale = TimeUtility.sliderToScale(i);
        const slider = TimeUtility.scaleToSlider(scale);
        expect(slider).toBeCloseTo(i);
      }
    });
  });
});
