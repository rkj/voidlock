/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UIOrchestrator } from "@src/renderer/app/UIOrchestrator";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameClient } from "@src/engine/GameClient";
import { ModalService } from "@src/renderer/ui/ModalService";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { GameState, MissionType } from "@src/shared/types";

describe("Pause and Speed Synchronization Repro", () => {
  let uiOrchestrator: UIOrchestrator;
  let mockGameClient: any;
  let mockModalService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock GameClient
    let isPaused = false;
    let timeScale = 1.0;

    mockGameClient = {
      getIsPaused: vi.fn(() => isPaused),
      getTimeScale: vi.fn(() => (isPaused ? 0.1 : timeScale)),
      getTargetScale: vi.fn(() => timeScale),
      setTimeScale: vi.fn((s: number) => {
        timeScale = s;
      }),
      pause: vi.fn(() => {
        isPaused = true;
      }),
      resume: vi.fn(() => {
        isPaused = false;
      }),
      togglePause: vi.fn(() => {
          if (isPaused) isPaused = false;
          else isPaused = true;
      })
    };

    mockModalService = {
      alert: vi.fn(),
    };

    // Setup DOM with standardized IDs from index.html
    document.body.innerHTML = `
      <div id="top-bar">
        <button id="btn-pause-toggle">Pause</button>
        <button id="btn-pause">Pause</button>
        <input type="range" id="game-speed" min="0" max="100" value="50" />
        <span id="speed-value">1.0x</span>
      </div>
    `;

    uiOrchestrator = new UIOrchestrator({
      gameClient: mockGameClient as unknown as GameClient,
      modalService: mockModalService as unknown as ModalService,
      getCurrentGameState: () => null,
    });
  });

  it("Reproduction: Failure to unpause via UI (togglePause uses setTimeScale(1.0) instead of resume())", () => {
    // 1. Manually pause the game client
    mockGameClient.pause();
    expect(mockGameClient.getIsPaused()).toBe(true);

    // 2. Trigger UI togglePause
    uiOrchestrator.togglePause();

    // 3. EXPECTATION: Game should be resumed using authoritative resume/togglePause methods.
    // This will FAIL because currently UIOrchestrator calls setTimeScale(1.0) which doesn't clear isPaused.
    expect(mockGameClient.getIsPaused()).toBe(false);
  });

  it("Reproduction: Incorrect speed slider mapping (ID mismatch)", () => {
    const hudManager = new HUDManager(
      null as any, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}
    );
    const slider = document.getElementById("game-speed") as HTMLInputElement;
    
    // 1. Mission state with 2.0x speed
    const state: GameState = {
      t: 100,
      status: "Playing",
      missionType: MissionType.Default,
      stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0 },
      settings: { isPaused: false, timeScale: 2.0, targetTimeScale: 2.0, allowTacticalPause: true },
      units: [], enemies: [], visibleCells: [], discoveredCells: [], objectives: [], squadInventory: {}, loot: [], mines: [], turrets: [], map: { width: 10, height: 10, cells: [] }
    } as any;
    
    // 2. Update HUD
    hudManager.update(state, null);
    
    // 3. EXPECTATION: Slider value should be updated based on the 2.0x scale.
    expect(slider.value).not.toBe("50"); 
    expect(slider.value).toBe(TimeUtility.scaleToSlider(2.0).toString());
  });

  it("Reproduction: Slider input sets raw value instead of logarithmic scale", () => {
    // Note: We use the existing 'game-speed' ID which we'll fix in implementation
    // For now we mock the binding to simulate the current behavior
    uiOrchestrator.setupAdditionalUIBindings({
        onAbortMission: () => {},
        onRetryMission: () => {},
        onForceWin: () => {},
        onForceLose: () => {}
    });

    const speedSlider = document.getElementById("game-speed") as HTMLInputElement;
    
    // 1. User moves slider to 75 (which should map to ~3.16x logarithmic)
    speedSlider.value = "75";
    speedSlider.dispatchEvent(new Event("input"));

    // 2. EXPECTATION: GameClient.setTimeScale should be called with ~3.16, not 75.
    // This will FAIL because currently it passes parseFloat(slider.value) directly.
    const lastCall = vi.mocked(mockGameClient.setTimeScale).mock.calls.at(-1);
    const valueSent = lastCall ? lastCall[0] : 0;
    
    expect(valueSent).toBeLessThan(11); // 75 is way out of bounds and clearly wrong
    expect(Math.abs(valueSent - 3.16)).toBeLessThan(0.1);
  });

  it("Reproduction: Speed slider desynchronization at mission start (HUDManager missing authoritative sync)", () => {
    const hudManager = new HUDManager(
      null as any, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}
    );

    const speedSlider = document.getElementById("game-speed") as HTMLInputElement;
    speedSlider.value = "50"; // Default

    const stateWithHighSpeed: GameState = {
      t: 100,
      status: "Playing",
      missionType: MissionType.Default,
      stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0 },
      settings: { isPaused: false, timeScale: 2.0, targetTimeScale: 2.0, allowTacticalPause: true },
      units: [], enemies: [], visibleCells: [], discoveredCells: [], objectives: [], squadInventory: {}, loot: [], mines: [], turrets: [], map: { width: 10, height: 10, cells: [] }
    } as any;

    // 1. Mission starts with 2.0x speed.
    hudManager.update(stateWithHighSpeed, null);

    // 2. EXPECTATION: Slider should move to reflect 2.0x (approx 65 on logarithmic scale).
    // This will FAIL because currently HUDManager doesn't update the slider value from state.
    expect(speedSlider.value).not.toBe("50");
    expect(speedSlider.value).toBe(TimeUtility.scaleToSlider(2.0).toString());
  });

  it("Reproduction: Progressive UI Visibility (Deployment, Prologue, Hostile Contact)", () => {
    const hudManager = new HUDManager(
      null as any, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}
    );

    document.body.innerHTML += `
      <div id="top-threat-container"></div>
      <div id="speed-control"></div>
    `;

    const threatContainer = document.getElementById("top-threat-container") as HTMLElement;
    const speedControl = document.getElementById("speed-control") as HTMLElement;

    const baseState: GameState = {
      t: 1000,
      status: "Playing",
      missionType: MissionType.Default,
      stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0 },
      settings: { isPaused: false, timeScale: 1.0, targetTimeScale: 1.0, allowTacticalPause: true },
      units: [], enemies: [], visibleCells: [], discoveredCells: [], objectives: [], squadInventory: {}, loot: [], mines: [], turrets: [], map: { width: 10, height: 10, cells: [] }
    } as any;

    // 1. Deployment: All hidden
    hudManager.update({ ...baseState, status: "Deployment" }, null);
    expect(threatContainer.style.visibility).toBe("hidden");
    expect(speedControl.style.visibility).toBe("hidden");

    // 2. Mission 1 (Prologue), No Contact: Speed/Pause hidden, Threat hidden
    hudManager.update({ ...baseState, missionType: MissionType.Prologue, stats: { ...baseState.stats, threatLevel: 0 } }, null);
    expect(speedControl.style.visibility).toBe("hidden");
    expect(threatContainer.style.visibility).toBe("hidden");

    // 3. Mission 1 (Prologue), Hostile Contact (Threat > 1): Threat appears
    hudManager.update({ ...baseState, missionType: MissionType.Prologue, stats: { ...baseState.stats, threatLevel: 5 } }, null);
    expect(threatContainer.style.visibility).toBe("visible");
    expect(speedControl.style.visibility).toBe("hidden"); // Speed still hidden in Mission 1

    // 4. Mission 1 (Prologue), Hostile Contact (Aliens Killed): Threat appears
    hudManager.update({ ...baseState, missionType: MissionType.Prologue, stats: { ...baseState.stats, aliensKilled: 1 } }, null);
    expect(threatContainer.style.visibility).toBe("visible");

    // 5. Standard Mission: Everything visible
    hudManager.update({ ...baseState, missionType: MissionType.Default }, null);
    expect(speedControl.style.visibility).toBe("visible");
    expect(threatContainer.style.visibility).toBe("visible");
  });
});
