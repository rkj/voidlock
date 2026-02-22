import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorialManager, AdvisorMessage } from '@src/renderer/controllers/TutorialManager';
import { GameClient } from '@src/engine/GameClient';
import { GameState, MissionType, Unit, UnitState } from '@src/shared/types';

describe('TutorialManager', () => {
  let gameClient: GameClient;
  let manager: TutorialManager;
  let onMessage: (msg: AdvisorMessage) => void;
  let listeners: ((state: GameState) => void)[] = [];

  beforeEach(() => {
    listeners = [];
    gameClient = {
      addStateUpdateListener: vi.fn((cb) => listeners.push(cb)),
      removeStateUpdateListener: vi.fn((cb) => {
        listeners = listeners.filter(l => l !== cb);
      }),
      pause: vi.fn(),
    } as unknown as GameClient;

    onMessage = vi.fn();
    manager = new TutorialManager(gameClient, onMessage);
  });

  const createMockState = (missionType: MissionType = MissionType.Prologue): GameState => ({
    missionType,
    units: [],
    enemies: [],
    objectives: [],
    visibleCells: [],
    t: 0,
    status: 'Playing',
    stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0 },
    settings: { mode: 'Simulation', isPaused: false, timeScale: 1, allowTacticalPause: true },
    squadInventory: {},
    loot: [],
    mines: [],
    turrets: [],
  } as unknown as GameState);

  it('should not trigger if disabled', () => {
    const state = createMockState();
    listeners.forEach(l => l(state));
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('should trigger start message immediately when enabled and state updates', () => {
    manager.enable();
    const state = createMockState();
    listeners.forEach(l => l(state));
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'start',
      text: expect.stringContaining('Commander')
    }));
  });

  it('should pause game on blocking message', () => {
    manager.enable();
    const state = createMockState();
    listeners.forEach(l => l(state));
    
    expect(gameClient.pause).toHaveBeenCalled();
  });

  it('should not trigger if mission type is not Prologue', () => {
    manager.enable();
    const state = createMockState(MissionType.Default);
    listeners.forEach(l => l(state));
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('should trigger first_move when unit moves', () => {
    manager.enable();
    const unit = { id: 'u1', pos: { x: 10, y: 10 }, hp: 100, maxHp: 100 } as Unit;
    
    // Initial state
    let state = createMockState();
    state.units = [unit];
    listeners.forEach(l => l(state));
    
    // Clear initial trigger (start)
    // Actually start message triggers once.
    // We expect onMessage to have been called for 'start'.
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'start' }));
    (onMessage as any).mockClear();
    
    // Move unit
    const movedUnit = { ...unit, pos: { x: 11, y: 10 } };
    state = { ...state, units: [movedUnit] };
    listeners.forEach(l => l(state));
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'first_move'
    }));
  });

  it('should trigger enemy_sighted when enemy is visible', () => {
    manager.enable();
    
    // Initial state (no enemies)
    let state = createMockState();
    listeners.forEach(l => l(state));
    (onMessage as any).mockClear();
    
    // Enemy appears and is visible
    const enemy = { id: 'e1', pos: { x: 5, y: 5 } };
    state = { 
        ...state, 
        enemies: [enemy] as any,
        visibleCells: ['5,5']
    };
    listeners.forEach(l => l(state));
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'enemy_sighted'
    }));
  });

  it('should trigger taking_damage when unit is hurt', () => {
    manager.enable();
    const unit = { id: 'u1', pos: { x: 10, y: 10 }, hp: 100, maxHp: 100 } as Unit;
    
    // Initial state
    let state = createMockState();
    state.units = [unit];
    listeners.forEach(l => l(state));
    (onMessage as any).mockClear();
    
    // Unit takes damage
    const hurtUnit = { ...unit, hp: 90 };
    state = { ...state, units: [hurtUnit] };
    listeners.forEach(l => l(state));
    
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'taking_damage'
    }));
  });
});
