/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Global Error Logging (main.ts)", () => {
  const originalOnError = window.onerror;
  const originalOnUnhandledRejection = window.onunhandledrejection;

  beforeEach(() => {
    window.onerror = null;
    window.onunhandledrejection = null;
  });

  afterEach(() => {
    window.onerror = originalOnError;
    window.onunhandledrejection = originalOnUnhandledRejection;
  });

  it("should have window.onerror and window.onunhandledrejection set after importing main.ts", async () => {
    // We need to import main.ts but it has side effects (starts the app)
    // So we might need to mock GameApp
    vi.mock("@src/renderer/app/GameApp", () => {
      return {
        GameApp: vi.fn().mockImplementation(() => {
          return {
            initialize: vi.fn().mockResolvedValue(undefined),
            start: vi.fn(),
          };
        }),
      };
    });

    // Use dynamic import to trigger the execution of main.ts
    const { bootstrap } = await import("../../src/renderer/main");
    await bootstrap();

    // Verify handlers are set
    expect(typeof window.onerror).toBe("function");
    expect(typeof window.onunhandledrejection).toBe("function");

    // Verify error logging by calling it directly
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    (window as any).onerror("Test Error", "test.js", 1, 1, new Error("Test Error"));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Global Error (main.ts):"),
      expect.anything(),
    );

    // Verify unhandledrejection logging
    (window as any).onunhandledrejection({
        reason: "Test Rejection"
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unhandled Promise Rejection (main.ts):"),
      "Test Rejection",
    );

    consoleSpy.mockRestore();
  });
});
