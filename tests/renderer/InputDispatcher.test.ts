// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InputDispatcher } from "@src/renderer/InputDispatcher";
import { InputContext, InputPriority } from "@src/shared/types";

describe("InputDispatcher", () => {
  let dispatcher: InputDispatcher;

  beforeEach(() => {
    // Reset singleton or state if necessary.
    // Since it's a singleton, we might need a way to clear contexts.
    dispatcher = InputDispatcher.getInstance();
    // @ts-ignore - access private for testing
    dispatcher.contextStack = [];
    // @ts-ignore
    dispatcher.focusStack = [];
  });

  it("should dispatch events to contexts in priority order", () => {
    const lowPriority = {
      id: "low",
      priority: InputPriority.Game,
      handleKeyDown: vi.fn(() => false),
      getShortcuts: () => [],
      trapsFocus: false,
    } as unknown as InputContext;

    const highPriority = {
      id: "high",
      priority: InputPriority.System,
      handleKeyDown: vi.fn(() => true), // Consume event
      getShortcuts: () => [],
      trapsFocus: false,
    } as unknown as InputContext;

    dispatcher.pushContext(lowPriority);
    dispatcher.pushContext(highPriority);

    const event = new KeyboardEvent("keydown", { key: "Enter" });
    window.dispatchEvent(event);

    expect(highPriority.handleKeyDown).toHaveBeenCalled();
    expect(lowPriority.handleKeyDown).not.toHaveBeenCalled();
  });

  it("should handle focus trapping", () => {
    const container = document.createElement("div");
    const btn1 = document.createElement("button");
    const btn2 = document.createElement("button");
    container.appendChild(btn1);
    container.appendChild(btn2);
    document.body.appendChild(container);

    const context = {
      id: "trap",
      priority: InputPriority.UI,
      handleKeyDown: vi.fn(() => false),
      getShortcuts: () => [],
      trapsFocus: true,
      container: container,
    } as unknown as InputContext;

    dispatcher.pushContext(context);

    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    // Tab on last element should focus first
    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
    });
    btn2.dispatchEvent(tabEvent);
    // Note: Dispatching event doesn't actually move focus in JSDOM sometimes,
    // but handleTabCycle should be called and it calls .focus()

    // We need to trigger it via the dispatcher's listener
    // @ts-ignore
    dispatcher.handleKeyDown(tabEvent);

    expect(document.activeElement).toBe(btn1);

    document.body.removeChild(container);
  });

  it("should restore focus when popping a focus-trapping context", () => {
    const originalBtn = document.createElement("button");
    document.body.appendChild(originalBtn);
    originalBtn.focus();
    expect(document.activeElement).toBe(originalBtn);

    const modal = document.createElement("div");
    const modalBtn = document.createElement("button");
    modal.appendChild(modalBtn);
    document.body.appendChild(modal);

    const context = {
      id: "modal",
      priority: InputPriority.System,
      handleKeyDown: vi.fn(() => false),
      getShortcuts: () => [],
      trapsFocus: true,
      container: modal,
    } as unknown as InputContext;

    dispatcher.pushContext(context);
    modalBtn.focus();
    expect(document.activeElement).toBe(modalBtn);

    dispatcher.popContext("modal");
    expect(document.activeElement).toBe(originalBtn);

    document.body.removeChild(originalBtn);
    document.body.removeChild(modal);
  });
});
