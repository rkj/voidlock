import { t } from "./i18n";
import { I18nKeys } from "./i18n/keys";

/**
 * Utility for time-related UI conversions.
 */
export class TimeUtility {
  /**
   * Maps an abstract slider value (0-100) to a logarithmic time scale (0.1x - 10.0x).
   * 50 maps exactly to 1.0x.
   */
  public static sliderToScale(val: number): number {
    // formula: scale = 10 ^ ((val - 50) / 50)
    const exponent = (val - 50) / 50;
    return Math.pow(10, exponent);
  }

  /**
   * Maps a time scale (0.1x - 10.0x) back to an abstract slider value (0-100).
   * 1.0x maps exactly to 50.
   */
  public static scaleToSlider(scale: number): number {
    // formula: val = 50 * log10(scale) + 50
    return 50 * Math.log10(scale) + 50;
  }

  /**
   * Formats a speed scale for display in the UI.
   */
  public static formatSpeed(scale: number, isPaused: boolean): string {
    const scaleStr = `${scale.toFixed(1)}x`;
    if (isPaused) {
      if (scale === 0) return t(I18nKeys.hud.paused_label, { scale: "0.0" });
      return t(I18nKeys.hud.active_pause_label, { scale: "0.1" });
    }
    return scaleStr;
  }
}

