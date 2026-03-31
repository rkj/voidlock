/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TooltipManager } from "@src/renderer/ui/TooltipManager";

describe("TooltipManager", () => {
  let container: HTMLDivElement;
  let manager: TooltipManager | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    document.body.classList.remove("mobile-touch");

    container = document.createElement("div");
    container.innerHTML = `
      <div id="target1" data-tooltip="Tooltip 1">Target 1</div>
      <div id="target2" data-tooltip="Tooltip 2">Target 2</div>
      <div id="no-tooltip">No Tooltip</div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
      manager = null;
    }
    vi.useRealTimers();
  });

  it("should show tooltip on click if mobile-touch is active", () => {
    document.body.classList.add("mobile-touch");
    manager = new TooltipManager();
    const target = document.getElementById("target1")!;

    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const popover = document.querySelector(".inspect-popover");
    expect(popover).not.toBeNull();
    expect(popover?.textContent).toBe("Tooltip 1");
    expect(target.classList.contains("inspecting")).toBe(true);
  });

  it("should not show tooltip on click if mobile-touch is not active", () => {
    manager = new TooltipManager();
    const target = document.getElementById("target1")!;

    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const popover = document.querySelector(".inspect-popover");
    expect(popover).toBeNull();
  });

  it("should toggle tooltip off when clicking the same target again", () => {
    document.body.classList.add("mobile-touch");
    manager = new TooltipManager();
    const target = document.getElementById("target1")!;

    // First click: show
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".inspect-popover")).not.toBeNull();

    // Advance time to bypass debounce
    vi.advanceTimersByTime(301);

    // Second click: dismiss
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".inspect-popover")).toBeNull();
  });

  it("should switch tooltip when clicking another target", () => {
    document.body.classList.add("mobile-touch");
    manager = new TooltipManager();
    const target1 = document.getElementById("target1")!;
    const target2 = document.getElementById("target2")!;

    target1.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".inspect-popover")?.textContent).toBe(
      "Tooltip 1",
    );

    // Advance time to bypass debounce
    vi.advanceTimersByTime(301);

    target2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".inspect-popover")?.textContent).toBe(
      "Tooltip 2",
    );
    expect(target1.classList.contains("inspecting")).toBe(false);
    expect(target2.classList.contains("inspecting")).toBe(true);
  });

  it("should dismiss tooltip when clicking outside", () => {
    document.body.classList.add("mobile-touch");
    manager = new TooltipManager();
    const target = document.getElementById("target1")!;
    const outside = document.getElementById("no-tooltip")!;

    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".inspect-popover")).not.toBeNull();

    // Advance time to bypass debounce
    vi.advanceTimersByTime(301);

    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".inspect-popover")).toBeNull();
  });

  it("should handle touchstart events", () => {
    manager = new TooltipManager();
    const target = document.getElementById("target1")!;

    target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true }));

    const popover = document.querySelector(".inspect-popover");
    expect(popover).not.toBeNull();
    expect(popover?.textContent).toBe("Tooltip 1");
  });
});
