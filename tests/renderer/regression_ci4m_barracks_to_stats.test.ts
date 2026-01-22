/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenManager } from "@src/renderer/ScreenManager";

describe("Regression voidlock-ci4m: Barracks to Statistics Transition", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen"></div>
      <div id="screen-campaign" class="screen" style="display:none"></div>
      <div id="screen-barracks" class="screen" style="display:none"></div>
      <div id="screen-statistics" class="screen" style="display:none"></div>
    `;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should allow transition from barracks to statistics", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // Navigate to campaign first
    sm.show("campaign");
    expect(sm.getCurrentScreen()).toBe("campaign");

    // Navigate to barracks
    sm.show("barracks");
    expect(sm.getCurrentScreen()).toBe("barracks");

    // Attempt navigate to statistics
    sm.show("statistics");

    expect(sm.getCurrentScreen()).toBe("statistics");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should allow transition from campaign to statistics", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // Navigate to campaign first
    sm.show("campaign");
    expect(sm.getCurrentScreen()).toBe("campaign");

    // Attempt navigate to statistics
    sm.show("statistics");

    expect(sm.getCurrentScreen()).toBe("statistics");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should allow transition from statistics to campaign", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // Navigate to statistics first (from main-menu)
    sm.show("statistics");
    expect(sm.getCurrentScreen()).toBe("statistics");

    // Attempt navigate to campaign
    sm.show("campaign");

    expect(sm.getCurrentScreen()).toBe("campaign");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should allow transition from mission-setup to statistics", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // Navigate to campaign first
    sm.show("campaign");
    // Then to mission-setup
    sm.show("mission-setup");
    expect(sm.getCurrentScreen()).toBe("mission-setup");

    // Attempt navigate to statistics
    sm.show("statistics");

    expect(sm.getCurrentScreen()).toBe("statistics");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
