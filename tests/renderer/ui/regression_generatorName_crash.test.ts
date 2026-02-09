/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { HUDManager } from '@src/renderer/ui/HUDManager';

describe('HUDManager regression', () => {
  it('should NOT throw if state.map is missing', () => {
    // Mock DOM
    document.body.innerHTML = '<div id="right-panel"></div>';
    const rightPanel = document.getElementById('right-panel')!;
    
    const mockState = {
      status: 'Playing',
      t: 1000,
      seed: 12345,
      missionType: 'Collect',
      settings: { debugOverlayEnabled: true, isPaused: false, timeScale: 1.0 },
      units: [],
      enemies: [],
      visibleCells: [],
      objectives: [],
      stats: { threatLevel: 0, aliensKilled: 0, casualties: 0 }
      // map is missing
    } as any;

    const mockMenuController = {
      getRenderableState: vi.fn().mockReturnValue({
        title: 'Orders',
        options: [],
        breadcrumbs: []
      })
    };

    const hudManager = new HUDManager(
      mockMenuController as any,
      vi.fn(), // onUnitClick
      vi.fn(), // onAbortMission
      vi.fn(), // onMenuInput
      vi.fn(), // onCopyWorldState
      vi.fn(), // onForceWin
      vi.fn(), // onForceLose
      vi.fn(), // onStartMission
    );
    
    // This should NOT throw anymore
    expect(() => (hudManager as any).updateRightPanel(mockState)).not.toThrow();

    const debugDiv = rightPanel.querySelector('.debug-controls');
    expect(debugDiv).toBeTruthy();
    expect(debugDiv?.innerHTML).toContain('Map:</strong> UnknownGenerator');
    expect(debugDiv?.innerHTML).toContain('Size:</strong> Unknown');
  });

  it('should NOT throw if state.map is missing during Deployment', () => {
    // Mock DOM
    document.body.innerHTML = '<div id="right-panel"></div>';
    const rightPanel = document.getElementById('right-panel')!;
    
    const mockState = {
      status: 'Deployment',
      t: 0,
      seed: 12345,
      missionType: 'Collect',
      settings: { debugOverlayEnabled: false, isPaused: false, timeScale: 1.0 },
      units: [],
      enemies: [],
      visibleCells: [],
      objectives: [],
      stats: { threatLevel: 0, aliensKilled: 0, casualties: 0 }
      // map is missing
    } as any;

    const mockMenuController = {
      getRenderableState: vi.fn()
    };

    const hudManager = new HUDManager(
      mockMenuController as any,
      vi.fn(), // onUnitClick
      vi.fn(), // onAbortMission
      vi.fn(), // onMenuInput
      vi.fn(), // onCopyWorldState
      vi.fn(), // onForceWin
      vi.fn(), // onForceLose
      vi.fn(), // onStartMission
    );
    
    // This should NOT throw anymore
    expect(() => (hudManager as any).updateRightPanel(mockState)).not.toThrow();
  });
});