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
    const mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };

    const screen = new EquipmentScreen(
      "screen-equipment",
      mockManager,
      mockModalService as any,
      initialConfig,
      onSave,
      onBack,
      null as any,
    );
    screen.show();

    // Find the right panel body (scroll content)
    const rightPanelBody = container.querySelector(
      ".armory-panel .scroll-content",
    ) as HTMLElement;
    expect(rightPanelBody).not.toBeNull();

    // Set scroll position manually
    rightPanelBody.scrollTop = 150;

    // Trigger a re-render by adding an item
    // Note: We need to find something that triggers re-render.
    // In supplies (right panel), clicking + triggers render.
    // We assume some items are rendered (e.g. Medkit from inventory or basic supplies)
    const buttons = Array.from(container.querySelectorAll("button"));
    const plusBtn = buttons.find((btn) => btn.textContent === "+");

    if (!plusBtn) {
      // If no plus button found, maybe empty inventory? But Basic supplies should be there.
      // Let's create one if needed or just force render via private method access if accessible
      // or assume the test setup works as before.
      // The previous test logic found 'Frag Grenade'.
    }
    
    // Fallback if Frag Grenade logic was sound
    if (plusBtn) {
        plusBtn.click();
    } else {
        // Force update via callback if possible? No easy way.
        // Let's rely on finding a button.
        // If initialConfig has medkit, there should be a row.
        const minusBtn = buttons.find((btn) => btn.textContent === "-");
        minusBtn?.click();
    }

    // After re-render, find the new right panel body
    const newRightPanelBody = container.querySelector(
      ".armory-panel .scroll-content",
    ) as HTMLElement;
    expect(newRightPanelBody).not.toBeNull();
    expect(newRightPanelBody).not.toBe(rightPanelBody);

    // The scroll position should be preserved
    expect(newRightPanelBody.scrollTop).toBe(150);
  });
});
