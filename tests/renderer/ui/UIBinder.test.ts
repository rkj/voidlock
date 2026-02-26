/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UIBinder } from "@src/renderer/ui/UIBinder";
import { GameState } from "@src/shared/types";

describe("UIBinder", () => {
  let binder: UIBinder;
  let root: HTMLElement;

  beforeEach(() => {
    binder = new UIBinder();
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  it("should sync textContent correctly", () => {
    root.innerHTML = `<span data-bind-text="stats.threatLevel"></span>`;
    binder.initialize(root);

    const state = {
      stats: { threatLevel: 42 }
    } as unknown as GameState;

    binder.sync(state);
    expect(root.querySelector("span")?.textContent).toBe("42");

    // Update state
    const nextState = {
      stats: { threatLevel: 88 }
    } as unknown as GameState;
    binder.sync(nextState);
    expect(root.querySelector("span")?.textContent).toBe("88");
  });

  it("should use transformers", () => {
    root.innerHTML = `<span data-bind-text="t" data-bind-transform="toSeconds"></span>`;
    binder.registerTransformer("toSeconds", (val) => (val / 1000).toFixed(1));
    binder.initialize(root);

    const state = { t: 1500 } as unknown as GameState;
    binder.sync(state);
    expect(root.querySelector("span")?.textContent).toBe("1.5");
  });

  it("should handle style-width", () => {
    root.innerHTML = `<div data-bind-style-width="stats.threatLevel"></div>`;
    binder.initialize(root);

    const state = { stats: { threatLevel: 50 } } as unknown as GameState;
    binder.sync(state);
    expect(root.querySelector("div")?.style.width).toBe("50%");
  });

  it("should handle visibility", () => {
    root.innerHTML = `<div data-bind-visibility="showMe"></div>`;
    binder.initialize(root);

    const state = { showMe: true } as unknown as GameState;
    binder.sync(state);
    expect(root.querySelector("div")?.style.visibility).toBe("visible");

    binder.sync({ showMe: false } as unknown as GameState);
    expect(root.querySelector("div")?.style.visibility).toBe("hidden");
  });

  it("should support multiple bindings on one element", () => {
    root.innerHTML = `<div data-bind-text="label" data-bind-style-color="color"></div>`;
    binder.initialize(root);

    const state = { label: "Alert", color: "red" } as unknown as GameState;
    binder.sync(state);
    const div = root.querySelector("div")!;
    expect(div.textContent).toBe("Alert");
    expect(div.style.color).toBe("red");
  });

  it("should only update when value changes (dirty checking)", () => {
    root.innerHTML = `<span data-bind-text="val"></span>`;
    binder.initialize(root);
    const span = root.querySelector("span")!;

    // Mock textContent setter to track calls
    let setCounter = 0;
    const originalTextContent = span.textContent;
    Object.defineProperty(span, 'textContent', {
        set: function(v) { setCounter++; (this as any)._textContent = v; },
        get: function() { return (this as any)._textContent; }
    });

    binder.sync({ val: "hello" } as unknown as GameState);
    expect(setCounter).toBe(1);

    binder.sync({ val: "hello" } as unknown as GameState);
    expect(setCounter).toBe(1); // Should not increase

    binder.sync({ val: "world" } as unknown as GameState);
    expect(setCounter).toBe(2);
  });
});
