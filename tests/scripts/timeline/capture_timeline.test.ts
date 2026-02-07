import { describe, expect, it } from "vitest";
import {
  buildBootstrapClickOrder,
  classifyRootResponse,
  shouldAbortForConsecutiveFailures,
  shouldRotateServer,
} from "../../../scripts/timeline/capture_timeline";

describe("capture timeline readiness checks", () => {
  it("accepts healthy html root responses", () => {
    const result = classifyRootResponse(
      200,
      "<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects 404 root responses", () => {
    const result = classifyRootResponse(404, "<html><body>404 Not Found</body></html>");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("HTTP 404");
  });

  it("rejects known error pages", () => {
    const result = classifyRootResponse(
      200,
      "<html><body>Internal Server Error - failed to resolve import</body></html>",
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("error page");
  });
});

describe("capture timeline failure escalation", () => {
  it("does not abort before threshold", () => {
    expect(shouldAbortForConsecutiveFailures(1, 3)).toBe(false);
    expect(shouldAbortForConsecutiveFailures(2, 3)).toBe(false);
  });

  it("aborts at threshold and beyond", () => {
    expect(shouldAbortForConsecutiveFailures(3, 3)).toBe(true);
    expect(shouldAbortForConsecutiveFailures(4, 3)).toBe(true);
  });
});

describe("capture timeline restart cadence", () => {
  it("rotates server at configured commit interval", () => {
    expect(shouldRotateServer(99, 100)).toBe(false);
    expect(shouldRotateServer(100, 100)).toBe(true);
    expect(shouldRotateServer(101, 100)).toBe(true);
  });

  it("disables cadence-based rotation when set to zero", () => {
    expect(shouldRotateServer(1000, 0)).toBe(false);
  });
});

describe("capture timeline bootstrap click order", () => {
  it("prioritizes known action ids when available", () => {
    const order = buildBootstrapClickOrder(["btn-start-mission", "btn-menu-custom"]);
    expect(order[0]).toBe("btn-menu-custom");
    expect(order[1]).toBe("btn-start-mission");
  });

  it("still includes default bootstrap fallbacks", () => {
    const order = buildBootstrapClickOrder([]);
    expect(order).toContain("btn-menu-custom");
    expect(order).toContain("btn-start-mission");
    expect(order).toContain("btn-deploy");
  });
});
