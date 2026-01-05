/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenManager } from "../../src/renderer/ScreenManager";

describe("Regression: voidlock-3dz9 Screen Transitions", () => {
  beforeEach(() => {
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
