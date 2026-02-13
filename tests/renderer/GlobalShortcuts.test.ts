// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InputDispatcher } from "@src/renderer/InputDispatcher";
import { GlobalShortcuts } from "@src/renderer/GlobalShortcuts";

describe("GlobalShortcuts & Help Overlay", () => {
  let globalShortcuts: GlobalShortcuts;
  let togglePause: any;
  let goBack: any;

  beforeEach(() => {
    document.body.innerHTML = "";
    // Reset InputDispatcher instance if possible, or clear context stack
    const dispatcher = InputDispatcher.getInstance();
    (dispatcher as any).contextStack = [];
    (dispatcher as any).focusStack = [];

    togglePause = vi.fn();
    goBack = vi.fn();

    globalShortcuts = new GlobalShortcuts(togglePause, goBack);
    globalShortcuts.init();
  });

  it("should handle Space to toggle pause", () => {
    const event = new KeyboardEvent("keydown", { code: "Space" });
    window.dispatchEvent(event);

    expect(togglePause).toHaveBeenCalled();
  });

  it("should handle ESC to go back", () => {
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    window.dispatchEvent(event);

    expect(goBack).toHaveBeenCalled();
  });

  it("should handle Q to go back", () => {
    const event = new KeyboardEvent("keydown", { key: "q" });
    window.dispatchEvent(event);

    expect(goBack).toHaveBeenCalled();
  });

  it("should show Help Overlay on '?'", () => {
    const event = new KeyboardEvent("keydown", { key: "?" });
    window.dispatchEvent(event);

    const backdrop = document.querySelector(
      ".help-overlay-backdrop",
    ) as HTMLElement;
    expect(backdrop).toBeTruthy();
    expect(backdrop.style.display).toBe("flex");

    const title = backdrop.querySelector("h2");
    expect(title?.textContent).toBe("Keyboard Shortcuts");
  });

  it("should display active shortcuts in Help Overlay", () => {
    const event = new KeyboardEvent("keydown", { key: "?" });
    window.dispatchEvent(event);

    const backdrop = document.querySelector(
      ".help-overlay-backdrop",
    ) as HTMLElement;
    const shortcutKeys = Array.from(
      backdrop.querySelectorAll(".shortcut-key"),
    ).map((el) => el.textContent);

    expect(shortcutKeys).toContain("Space");
    expect(shortcutKeys).toContain("ESC / Q");
    expect(shortcutKeys).toContain("?");
  });

  it("should hide Help Overlay on ESC", () => {
    // Show first
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    let backdrop = document.querySelector(
      ".help-overlay-backdrop",
    ) as HTMLElement;
    expect(backdrop.style.display).toBe("flex");

    // Hide with ESC
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(backdrop.style.display).toBe("none");
  });

  it("should hide Help Overlay on '?'", () => {
    // Show first
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    let backdrop = document.querySelector(
      ".help-overlay-backdrop",
    ) as HTMLElement;
    expect(backdrop.style.display).toBe("flex");

    // Hide with '?'
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    expect(backdrop.style.display).toBe("none");
  });

  it("should show context-aware shortcuts from other contexts", () => {
    const mockTacticalContext = {
      id: "Tactical",
      priority: 50,
      trapsFocus: false,
      handleKeyDown: vi.fn(() => false),
      getShortcuts: () => [
        {
          key: "1-9",
          label: "1-9",
          description: "Select Option",
          category: "Tactical" as const,
        },
      ],
    };
    InputDispatcher.getInstance().pushContext(mockTacticalContext);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));

    const backdrop = document.querySelector(
      ".help-overlay-backdrop",
    ) as HTMLElement;
    const shortcutKeys = Array.from(
      backdrop.querySelectorAll(".shortcut-key"),
    ).map((el) => el.textContent);

    expect(shortcutKeys).toContain("1-9");
  });
});
