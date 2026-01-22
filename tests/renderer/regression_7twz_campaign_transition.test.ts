/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenManager } from "../../src/renderer/ScreenManager";

describe("Regression: voidlock-7twz Campaign Transition", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
      </div>

      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
          </div>
      </div>

      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="map-config-section"></div>
        <div id="squad-builder"></div>
      </div>

      <div id="screen-debrief"></div>
    `;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should allow campaign -> mission-setup transition", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // Transition path: main-menu -> campaign -> mission-setup
    sm.show("campaign");
    expect(sm.getCurrentScreen()).toBe("campaign");

    sm.show("mission-setup");
    expect(sm.getCurrentScreen()).toBe("mission-setup");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
