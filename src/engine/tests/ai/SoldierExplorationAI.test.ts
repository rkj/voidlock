import { describe, it, expect, beforeEach } from 'vitest';
import { CoreEngine } from '../../CoreEngine';
import { MapDefinition, CellType, UnitState, CommandType, SquadConfig, Vector2 } from '../../../shared/types';
import { GameGrid } from '../../GameGrid';

describe('Soldier Exploration AI', () => {
  let engine: CoreEngine;
  let mockMap: MapDefinition;
  const defaultSquad: SquadConfig = [{archetypeId: "assault", count: 1}];

  beforeEach(() => {
    // A 3x3 map, with (0,0) as spawn, (2,2) as extraction, and some undiscovered cells
    mockMap = {
      width: 3,
      height: 3,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: false, w: true } }, // Start
        { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: false, w: false } },
        { x: 2, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: false, w: false } },

        { x: 0, y: 1, type: CellType.Floor, walls: { n: false, e: false, s: false, w: true } },
        { x: 1, y: 1, type: CellType.Floor, walls: { n: false, e: false, s: false, w: false } },
        { x: 2, y: 1, type: CellType.Floor, walls: { n: false, e: true, s: false, w: false } },

        { x: 0, y: 2, type: CellType.Floor, walls: { n: false, e: false, s: true, w: true } },
        { x: 1, y: 2, type: CellType.Floor, walls: { n: false, e: false, s: true, w: false } },
        { x: 2, y: 2, type: CellType.Floor, walls: { n: false, e: true, s: true, w: false } }, // Extraction
      ],
      spawnPoints: [{ id: 's1', pos: { x: 0, y: 0 }, radius: 1 }],
      extraction: { x: 2, y: 2 },
      objectives: []
    };

    engine = new CoreEngine(mockMap, 123, defaultSquad, true, false); // agentControlEnabled = true
    engine.clearUnits(); // Clear default unit to add our own
    engine.addUnit({
      id: 'u1',
      pos: { x: 0.5, y: 0.5 }, // Start at (0,0)
      hp: 100, maxHp: 100,
      state: UnitState.Idle,
      damage: 10, fireRate: 100, attackRange: 1, sightRange: 0.1, // Small sight to ensure neighbors are undiscovered
      speed: 2,
      commandQueue: []
    });
  });

  it('should move towards the closest undiscovered cell when idle', () => {
    // At start, only (0,0) is discovered (unit sight range 0.1) by LOS after first update.
    // Closest undiscovered from (0,0) is (0,1) or (1,0) (distance 1)

    // Simulate several updates to allow AI to kick in and move
    for (let i = 0; i < 2; i++) { // Reduced to 2 ticks to ensure it's still moving
        engine.update(100); 
    }
    const state = engine.getState();
    const unit = state.units[0];
    
    expect(unit.state).toBe(UnitState.Moving);
    // Unit should be moving to (0,1) or (1,0)
    const targetCell = { x: Math.floor(unit.targetPos!.x), y: Math.floor(unit.targetPos!.y) };
    const validTargets = [{ x: 0, y: 1 }, { x: 1, y: 0 }];
    expect(validTargets).toContainEqual(targetCell);

    // Continue until discoveredCells grows
    for (let i = 0; i < 20; i++) {
        engine.update(100);
    }
    const finalState = engine.getState();
    const finalUnit = finalState.units[0];
    // Unit should have moved, and discovered cells should be more than 1
    expect(finalState.discoveredCells.length).toBeGreaterThan(1);
    expect(finalUnit.state).toBe(UnitState.Moving); // Still exploring unless it reached extraction point, which it won't yet.
  });

  it('should move towards extraction once the entire map is discovered', () => {
    // Force map to be fully discovered
    // Manually add all floor cells to discoveredCells
    const internalState = (engine as any).state;
    mockMap.cells.forEach(c => {
        if (c.type === CellType.Floor) {
            internalState.discoveredCells.push(`${c.x},${c.y}`);
        }
    });
    // Remove duplicates and ensure unique
    internalState.discoveredCells = Array.from(new Set(internalState.discoveredCells));

    // Unit is at (0.5,0.5). Extraction is at (2,2).
    // Simulate updates until unit reaches extraction
    for (let i = 0; i < 50; i++) { // Enough time for unit to move from (0,0) to (2,2)
        engine.update(100); 
    }
    const state = engine.getState();
    const unit = state.units[0];

    expect(state.discoveredCells.length).toBe(
        mockMap.cells.filter(c => c.type === CellType.Floor).length
    );
    expect(unit.state).toBe(UnitState.Extracted); // Should be extracted if it reached
    // Check if unit is within the extraction cell
    expect(Math.floor(unit.pos.x)).toBe(mockMap.extraction!.x);
    expect(Math.floor(unit.pos.y)).toBe(mockMap.extraction!.y);
  });
});
