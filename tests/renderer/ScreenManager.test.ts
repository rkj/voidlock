/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenManager } from "../../src/renderer/ScreenManager";

describe("ScreenManager", () => {
  beforeEach(() => {
    // Mock document.getElementById for all screens
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen"></div>
      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-engineering" class="screen" style="display:none"></div>
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
              <div id="screen-settings" class="screen" style="display:none"></div>
          </div>
      </div>
      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="unit-style-preview"></div>
      </div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
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

    // campaign -> equipment
    sm.show("equipment");
    expect(sm.getCurrentScreen()).toBe("equipment");

    // equipment -> campaign
    sm.show("campaign");
    expect(sm.getCurrentScreen()).toBe("campaign");
  });

  it("should block invalid transitions and log error", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // main-menu -> equipment (invalid)
    sm.show("equipment");
    expect(sm.getCurrentScreen()).toBe("main-menu");
    expect(errorSpy).toHaveBeenCalledWith(
      "Invalid screen transition: main-menu -> equipment",
    );

    // main-menu -> campaign (valid)
    sm.show("campaign");
    errorSpy.mockClear();
  });

  it("should handle goBack correctly", () => {
    const sm = new ScreenManager();

    sm.show("campaign");
    sm.show("equipment");
    expect(sm.getCurrentScreen()).toBe("equipment");

    sm.goBack();
    expect(sm.getCurrentScreen()).toBe("campaign");

    sm.goBack();
    expect(sm.getCurrentScreen()).toBe("main-menu");
  });
});
