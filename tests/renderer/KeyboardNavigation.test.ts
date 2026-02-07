// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UIUtils } from "@src/renderer/utils/UIUtils";
import { InputDispatcher } from "@src/renderer/InputDispatcher";
import { InputPriority } from "@src/shared/types";

describe("Keyboard Navigation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // Reset singleton
    const dispatcher = InputDispatcher.getInstance();
    // @ts-ignore
    dispatcher.contextStack = [];
    // @ts-ignore
    dispatcher.focusStack = [];
  });

  describe("UIUtils.handleArrowNavigation", () => {
    it("should navigate between focusable elements with arrow keys", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <button id="b1">Btn 1</button>
        <button id="b2">Btn 2</button>
        <button id="b3">Btn 3</button>
      `;
      document.body.appendChild(container);

      const b1 = document.getElementById("b1")!;
      const b2 = document.getElementById("b2")!;
      const b3 = document.getElementById("b3")!;

      b1.focus();
      expect(document.activeElement).toBe(b1);

      // ArrowDown
      const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
      UIUtils.handleArrowNavigation(downEvent, container);
      expect(document.activeElement).toBe(b2);

      // ArrowRight
      const rightEvent = new KeyboardEvent("keydown", { key: "ArrowRight" });
      UIUtils.handleArrowNavigation(rightEvent, container);
      expect(document.activeElement).toBe(b3);

      // ArrowDown (wrap around)
      UIUtils.handleArrowNavigation(downEvent, container);
      expect(document.activeElement).toBe(b1);

      // ArrowUp (wrap around)
      const upEvent = new KeyboardEvent("keydown", { key: "ArrowUp" });
      UIUtils.handleArrowNavigation(upEvent, container);
      expect(document.activeElement).toBe(b3);
    });

    it("should ignore disabled elements", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <button id="b1">Btn 1</button>
        <button id="b2" disabled>Btn 2</button>
        <button id="b3">Btn 3</button>
      `;
      document.body.appendChild(container);

      const b1 = document.getElementById("b1")!;
      const b3 = document.getElementById("b3")!;

      b1.focus();
      
      const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
      UIUtils.handleArrowNavigation(downEvent, container);
      expect(document.activeElement).toBe(b3);
    });
  });

  it("should trap focus within a container", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <button id="first">First</button>
      <button id="last">Last</button>
    `;
    document.body.appendChild(container);

    const first = document.getElementById("first")!;
    const last = document.getElementById("last")!;

    const dispatcher = InputDispatcher.getInstance();
    dispatcher.pushContext({
      id: "test",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: container,
      handleKeyDown: () => false,
      getShortcuts: () => [],
    });

    last.focus();
    
    // Simulate Tab on last element
    const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    // @ts-ignore
    dispatcher.handleKeyDown(tabEvent);

    expect(document.activeElement).toBe(first);

    // Simulate Shift+Tab on first element
    first.focus();
    const shiftTabEvent = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true });
    // @ts-ignore
    dispatcher.handleKeyDown(shiftTabEvent);

    expect(document.activeElement).toBe(last);
  });
});
