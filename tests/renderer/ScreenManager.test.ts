/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenManager } from "../../src/renderer/ScreenManager";

describe("ScreenManager", () => {
  beforeEach(() => {
    // Mock document.getElementById for all screens
    document.body.innerHTML = `
      <div id="screen-main-menu"></div>
      <div id="screen-campaign"></div>
      <div id="screen-mission-setup"></div>
      <div id="screen-equipment"></div>
      <div id="screen-mission"></div>
      <div id="screen-barracks"></div>
      <div id="screen-debrief"></div>
    `;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should initialize with main-menu", () => {
    const sm = new ScreenManager();
    expect(sm.getCurrentScreen()).toBe("main-menu");
    expect(document.getElementById("screen-main-menu")?.style.display).toBe(
      "flex",
    );
  });

  it("should allow valid transitions", () => {
    const sm = new ScreenManager();

    // main-menu -> campaign
    sm.show("campaign");
    expect(sm.getCurrentScreen()).toBe("campaign");
    expect(document.getElementById("screen-campaign")?.style.display).toBe(
      "flex",
    );
    expect(document.getElementById("screen-main-menu")?.style.display).toBe(
      "none",
    );

    // campaign -> barracks
    sm.show("barracks");
    expect(sm.getCurrentScreen()).toBe("barracks");

    // barracks -> campaign
    sm.show("campaign");
    expect(sm.getCurrentScreen()).toBe("campaign");
  });

  it("should block invalid transitions and log error", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // main-menu -> barracks (invalid)
    sm.show("barracks");
    expect(sm.getCurrentScreen()).toBe("main-menu");
    expect(errorSpy).toHaveBeenCalledWith(
      "Invalid screen transition: main-menu -> barracks",
    );

    // main-menu -> campaign (valid)
    sm.show("campaign");
    errorSpy.mockClear();

    // campaign -> mission-setup (invalid)
    sm.show("mission-setup");
    expect(sm.getCurrentScreen()).toBe("campaign");
    expect(errorSpy).toHaveBeenCalledWith(
      "Invalid screen transition: campaign -> mission-setup",
    );
  });

  it("should handle goBack correctly", () => {
    const sm = new ScreenManager();

    sm.show("campaign");
    sm.show("barracks");
    expect(sm.getCurrentScreen()).toBe("barracks");

    sm.goBack();
    expect(sm.getCurrentScreen()).toBe("campaign");

    sm.goBack();
    expect(sm.getCurrentScreen()).toBe("main-menu");
  });
});
