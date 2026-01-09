// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("Regression: voidlock-5zjs - Scrap Balance in Equipment Screen", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should display Scrap and Intel balance when campaign is active", () => {
    mockManager = {
      getState: vi.fn().mockReturnValue({
        scrap: 450,
        intel: 120,
      }),
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const overlay = container.querySelector(".overlay-stats");
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain("SCRAP: 450");
    expect(overlay?.textContent).toContain("INTEL: 120");

    // Check for colors
    const scrapValue = Array.from(overlay!.querySelectorAll("span")).find(s => s.textContent === "450");
    expect(scrapValue?.style.color).toBe("var(--color-primary)");

    const intelValue = Array.from(overlay!.querySelectorAll("span")).find(s => s.textContent === "120");
    expect(intelValue?.style.color).toBe("var(--color-accent)");
  });

  it("should not display stats overlay when campaign is NOT active", () => {
    mockManager = {
      getState: vi.fn().mockReturnValue(null),
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
    );
    screen.show();

    const overlay = container.querySelector(".overlay-stats");
    expect(overlay).toBeNull();
  });
});
