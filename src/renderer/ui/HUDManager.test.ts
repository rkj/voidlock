// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "./HUDManager";
import { GameState, UnitState, Unit } from "../../shared/types";

describe("HUDManager", () => {
  let hud: HUDManager;
  let mockMenuController: any;
  let onUnitClick: any;
  let onAbortMission: any;
  let onMenuInput: any;

  const mockState: GameState = {
    t: 1000,
    status: "Playing",
    threatLevel: 25,
    aliensKilled: 5,
    casualties: 0,
    map: { width: 10, height: 10, cells: [] },
    units: [
      {
        id: "s1",
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        accuracy: 80,
        damage: 10,
        attackRange: 5,
        speed: 20,
        sightRange: 10,
        engagementPolicy: "ENGAGE",
      } as any,
    ],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-status"></div>
      <div id="version-display"></div>
      <div id="menu-version"></div>
      <div id="top-threat-fill"></div>
      <div id="top-threat-value"></div>
      <div id="right-panel"></div>
      <div id="soldier-list"></div>
    `;

    mockMenuController = {
      getRenderableState: vi.fn(() => ({
        title: "ACTIONS",
        options: [],
      })),
    };
    onUnitClick = vi.fn();
    onAbortMission = vi.fn();
    onMenuInput = vi.fn();

    hud = new HUDManager(
      mockMenuController,
      onUnitClick,
      onAbortMission,
      onMenuInput,
      "1.0.0"
    );
  });

  it("should update top bar stats", () => {
    hud.update(mockState, null);
    
    const statusEl = document.getElementById("game-status");
    expect(statusEl?.innerHTML).toContain("TIME:</span>1.0s");
    expect(statusEl?.innerHTML).toContain("STATUS:</span>Playing");

    const threatValue = document.getElementById("top-threat-value");
    expect(threatValue?.textContent).toBe("25%");
  });

  it("should render soldier list", () => {
    hud.update(mockState, null);
    
    const list = document.getElementById("soldier-list");
    const items = list?.querySelectorAll(".soldier-item");
    expect(items?.length).toBe(1);
    expect(items?.[0].querySelector(".u-id")?.textContent).toBe("s1");
    expect(items?.[0].querySelector(".u-hp")?.textContent).toBe("100/100");
  });

  it("should update HP bar and stats", () => {
    const woundedState = {
      ...mockState,
      units: [{ ...mockState.units[0], hp: 50 }]
    };
    
    hud.update(woundedState, null);
    
    const hpText = document.querySelector(".u-hp");
    expect(hpText?.textContent).toBe("50/100");
    
    const hpFill = document.querySelector(".hp-fill") as HTMLElement;
    expect(hpFill.style.width).toBe("50%");
  });

  it("should highlight selected unit", () => {
    hud.update(mockState, "s1");
    
    const item = document.querySelector(".soldier-item");
    expect(item?.classList.contains("selected")).toBe(true);
  });

  it("should call onUnitClick when a soldier item is clicked", () => {
    hud.update(mockState, null);
    
    const item = document.querySelector(".soldier-item") as HTMLElement;
    item.click();
    
    expect(onUnitClick).toHaveBeenCalledWith(mockState.units[0]);
  });

  it("should call onMenuInput when a menu item is clicked", () => {
    mockMenuController.getRenderableState.mockReturnValue({
      title: "ACTIONS",
      options: [
        { key: "1", label: "1. MOVE", dataAttributes: { index: "1" } }
      ]
    });

    hud.update(mockState, null);

    const menuItem = document.querySelector(".menu-item.clickable") as HTMLElement;
    expect(menuItem).not.toBeNull();
    
    menuItem.click();
    expect(onMenuInput).toHaveBeenCalledWith("1");
  });
});
