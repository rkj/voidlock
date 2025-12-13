import { describe, it, expect, beforeEach } from 'vitest';
import { LineOfSight } from './LineOfSight';
import { GameGrid } from './GameGrid';
import { MapDefinition, CellType } from '../shared/types';

describe('LineOfSight', () => {
  let mockMap: MapDefinition;
  let gameGrid: GameGrid;
  let los: LineOfSight;

  beforeEach(() => {
    // 5x5 map with a wall in center (2,2)
    mockMap = {
      width: 5,
      height: 5,
      cells: [
        { x: 0, y: 0, type: CellType.Floor }, { x: 1, y: 0, type: CellType.Floor }, { x: 2, y: 0, type: CellType.Floor }, { x: 3, y: 0, type: CellType.Floor }, { x: 4, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor }, { x: 1, y: 1, type: CellType.Floor }, { x: 2, y: 1, type: CellType.Floor }, { x: 3, y: 1, type: CellType.Floor }, { x: 4, y: 1, type: CellType.Floor },
        { x: 0, y: 2, type: CellType.Floor }, { x: 1, y: 2, type: CellType.Floor }, { x: 2, y: 2, type: CellType.Wall  }, { x: 3, y: 2, type: CellType.Floor }, { x: 4, y: 2, type: CellType.Floor },
        { x: 0, y: 3, type: CellType.Floor }, { x: 1, y: 3, type: CellType.Floor }, { x: 2, y: 3, type: CellType.Floor }, { x: 3, y: 3, type: CellType.Floor }, { x: 4, y: 3, type: CellType.Floor },
        { x: 0, y: 4, type: CellType.Floor }, { x: 1, y: 4, type: CellType.Floor }, { x: 2, y: 4, type: CellType.Floor }, { x: 3, y: 4, type: CellType.Floor }, { x: 4, y: 4, type: CellType.Floor },
      ],
    };
    gameGrid = new GameGrid(mockMap);
    los = new LineOfSight(gameGrid);
  });

  it('should see adjacent cells', () => {
    const origin = { x: 0.5, y: 0.5 };
    const visible = los.computeVisibleCells(origin, 1.5);
    expect(visible).toContain('0,0');
    expect(visible).toContain('1,0');
    expect(visible).toContain('0,1');
    expect(visible).toContain('1,1'); // Diagonal 1.414 < 1.5
  });

  it('should be blocked by walls', () => {
    // Viewer at (0, 2), Wall at (2, 2), Target at (4, 2)
    // Ray (0.5, 2.5) -> (4.5, 2.5) hits (2, 2)
    const origin = { x: 0.5, y: 2.5 };
    const visible = los.computeVisibleCells(origin, 5);
    
    expect(visible).toContain('0,2'); // Self
    expect(visible).toContain('1,2'); // Before wall
    expect(visible).toContain('2,2'); // The wall itself (usually visible)
    
    // Check behind wall
    expect(visible).not.toContain('3,2'); 
    expect(visible).not.toContain('4,2');
  });

  it('should see around corners', () => {
    // Wall at (2,2). Viewer at (1,1). Target (3,3) - diagonal blocked?
    // Viewer (1.5, 1.5). Wall center (2.5, 2.5). Target (3.5, 3.5).
    // Ray passes through (2,2).
    const origin = { x: 1.5, y: 1.5 };
    const visible = los.computeVisibleCells(origin, 5);
    
    expect(visible).toContain('2,2'); // Wall visible
    expect(visible).not.toContain('3,3'); // Blocked by wall center
  });
});
