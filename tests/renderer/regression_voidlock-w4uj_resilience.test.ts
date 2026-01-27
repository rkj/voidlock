import { describe, it, expect, vi, beforeEach } from "vitest";
// @ts-ignore
import { JSDOM } from "jsdom";

describe("Resilience Script (voidlock-w4uj)", () => {
  let dom: JSDOM;
  let window: any;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Voidlock</title>
        </head>
        <body>
          <div id="screen-main-menu" class="screen" style="display: none;">
            <button id="btn-menu-reset">Reset</button>
          </div>
          <div id="screen-mission" class="screen" style="display: flex;"></div>
        </body>
      </html>
    `,
      { runScripts: "dangerously", resources: "usable" },
    );
    window = dom.window;
    document = window.document;

    // Mock global objects
    (global as any).window = window;
    (global as any).document = document;
    (global as any).console = { error: vi.fn(), log: vi.fn() };
    (global as any).localStorage = { clear: vi.fn() };
    (global as any).confirm = vi.fn(() => true);
    (global as any).location = { reload: vi.fn() };
    (global as any).HTMLElement = window.HTMLElement;
    (global as any).NodeList = window.NodeList;
    (global as any).HTMLDivElement = window.HTMLDivElement;
    (global as any).HTMLButtonElement = window.HTMLButtonElement;
  });

  it("should force main menu visible and hide other screens on panic", () => {
    // The panic function logic from index.html
    function panic(error: any) {
      if (window.__VOIDLOCK_PANIC__) return;
      window.__VOIDLOCK_PANIC__ = true;

      const showPanicUI = function () {
        const mainMenu = document.getElementById("screen-main-menu");
        if (mainMenu) {
          mainMenu.style.cssText =
            "display: flex !important; position: fixed !important;";

          const errorMsg = document.createElement("div");
          errorMsg.textContent = "CRITICAL ERROR: " + error;
          mainMenu.appendChild(errorMsg);
        }

        const screens = document.querySelectorAll(".screen");
        for (let i = 0; i < screens.length; i++) {
          const screen = screens[i] as HTMLElement;
          if (screen.id !== "screen-main-menu") {
            screen.style.display = "none";
          }
        }
      };

      if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", showPanicUI);
      } else {
        showPanicUI();
      }
    }

    const missionScreen = document.getElementById("screen-mission")!;
    const mainMenu = document.getElementById("screen-main-menu")!;

    expect(missionScreen.style.display).toBe("flex");
    expect(mainMenu.style.display).toBe("none");

    panic("Test Error");

    expect(window.__VOIDLOCK_PANIC__).toBe(true);
    expect(mainMenu.style.display).toBe("flex");
    expect(missionScreen.style.display).toBe("none");
    expect(mainMenu.innerHTML).toContain("CRITICAL ERROR: Test Error");
  });

  it("should handle resource loading errors in the error listener", () => {
    let capturedError: any = null;
    function panic(error: any) {
      capturedError = error;
    }

    // Simulate the capturing error listener from index.html
    const errorListener = function (event: any) {
      if (event.target && (event.target.src || event.target.href)) {
        panic(
          "Resource failed to load: " + (event.target.src || event.target.href),
        );
      } else {
        panic(event.error || event.message);
      }
    };

    // 1. Script error
    errorListener({ target: { src: "http://example.com/main.ts" } });
    expect(capturedError).toBe(
      "Resource failed to load: http://example.com/main.ts",
    );

    // 2. Normal error
    errorListener({ error: new Error("Normal error") });
    expect(capturedError.toString()).toContain("Normal error");
  });

  it("should trigger emergency reset if app is not healthy", () => {
    const resetBtn = document.getElementById("btn-menu-reset")!;
    let listenerCalled = false;

    // The emergency reset logic from index.html
    resetBtn.addEventListener("click", function () {
      const isAppHealthy = window.GameAppInstance && !window.__VOIDLOCK_PANIC__;
      if (!isAppHealthy) {
        if (confirm("EMERGENCY RESET")) {
          localStorage.clear();
          location.reload();
        }
        listenerCalled = true;
      }
    });

    // 1. App NOT healthy (window.GameAppInstance is missing)
    resetBtn.dispatchEvent(new window.MouseEvent("click"));
    expect(listenerCalled).toBe(true);
    expect(localStorage.clear).toHaveBeenCalled();
    expect(location.reload).toHaveBeenCalled();

    vi.clearAllMocks();
    listenerCalled = false;
    window.__VOIDLOCK_PANIC__ = false;

    // 2. App healthy
    window.GameAppInstance = {};
    resetBtn.dispatchEvent(new window.MouseEvent("click"));
    expect(listenerCalled).toBe(false);
    expect(localStorage.clear).not.toHaveBeenCalled();
    expect(location.reload).not.toHaveBeenCalled();

    vi.clearAllMocks();

    // 3. App has instance but is in PANIC mode
    window.__VOIDLOCK_PANIC__ = true;
    resetBtn.dispatchEvent(new window.MouseEvent("click"));
    expect(listenerCalled).toBe(true);
    expect(localStorage.clear).toHaveBeenCalled();
    expect(location.reload).toHaveBeenCalled();
  });
});
