// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentScreen } from "@src/renderer/screens/EquipmentScreen";
import { SquadConfig } from "@src/shared/types";

describe("EquipmentScreen Regression: Scroll Reset", () => {
  let container: HTMLElement;
  let initialConfig: SquadConfig;
  let onSave: any;
  let onBack: any;
  let mockManager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-equipment"></div>';
    container = document.getElementById("screen-equipment")!;

    initialConfig = {
      soldiers: [{ archetypeId: "assault" }, { archetypeId: "medic" }],
      inventory: { medkit: 1 },
    };

    mockManager = {
      getState: vi.fn().mockReturnValue(null),
    };

    onSave = vi.fn();
    onBack = vi.fn();
  });

  it("should preserve scroll position of panels after re-rendering", () => {
    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    // Find the right panel (Armory)
    const rightPanel = container.querySelector(".armory-panel") as HTMLElement;
    expect(rightPanel).not.toBeNull();

    // Set scroll position manually (JSDOM doesn't do layout, but we can set this)
    rightPanel.scrollTop = 150;
    
    // Trigger a re-render by adding an item
    const rows = Array.from(container.querySelectorAll("div")).filter((el) =>
      el.textContent?.includes("Frag Grenade"),
    );
    const row = rows[0].parentElement!;
    const plusBtn = Array.from(row.querySelectorAll("button")).find(
      (btn) => btn.textContent === "+",
    );
    
    plusBtn?.click();

    // After re-render, find the new right panel
    const newRightPanel = container.querySelector(".armory-panel") as HTMLElement;
    expect(newRightPanel).not.toBeNull();
    // It should NOT be the same element instance
    expect(newRightPanel).not.toBe(rightPanel);
    
    // The scroll position should be preserved
    expect(newRightPanel.scrollTop).toBe(150);
  });
});
