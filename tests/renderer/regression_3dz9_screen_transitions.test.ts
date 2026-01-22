/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenManager } from "../../src/renderer/ScreenManager";

describe("Regression: voidlock-3dz9 Screen Transitions", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen"></div>
      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
          </div>
      </div>
      <div id="screen-mission-setup" class="screen" style="display:none"></div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-barracks" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should allow equipment -> mission transition", () => {
    const sm = new ScreenManager();
    const errorSpy = vi.spyOn(console, "error");

    // Transition path: main-menu -> mission-setup -> equipment -> mission
    sm.show("mission-setup");
    expect(sm.getCurrentScreen()).toBe("mission-setup");

    sm.show("equipment");
    expect(sm.getCurrentScreen()).toBe("equipment");

    sm.show("mission");
    expect(sm.getCurrentScreen()).toBe("mission");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
