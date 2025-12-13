import { MapDefinition, CellType, SpawnPoint, Objective } from '../shared/types';
import { PRNG } from '../shared/PRNG';

export class MapGenerator {
  private prng: PRNG;

  constructor(seed: number) {
    this.prng = new PRNG(seed);
  }

  public generate(width: number, height: number): MapDefinition {
    const cells = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        cells.push({ x, y, type: CellType.Wall });
      }
    }

    // Random walker
    let cx = Math.floor(width / 2);
    let cy = Math.floor(height / 2);
    const maxSteps = width * height * 2; // Enough to carve a good chunk

    for (let i = 0; i < maxSteps; i++) {
      const idx = cy * width + cx;
      if (cells[idx].type === CellType.Wall) {
        cells[idx].type = CellType.Floor;
      }

      const dir = this.prng.nextInt(0, 3);
      let dx = 0, dy = 0;
      if (dir === 0) dy = -1;
      else if (dir === 1) dy = 1;
      else if (dir === 2) dx = -1;
      else dx = 1;

      cx += dx;
      cy += dy;

      // Clamp
      cx = Math.max(1, Math.min(width - 2, cx));
      cy = Math.max(1, Math.min(height - 2, cy));
    }

    // Find valid floors
    const floors = cells.filter(c => c.type === CellType.Floor);
    if (floors.length === 0) {
        // Fallback if super unlucky (seed 0?)
        cells[0].type = CellType.Floor;
        floors.push(cells[0]);
    }

    // Place Extraction at first floor found (or random floor)
    const extractionIdx = this.prng.nextInt(0, floors.length - 1);
    const extractionCell = floors[extractionIdx];
    const extraction = { x: extractionCell.x, y: extractionCell.y };

    // Place Objective far away? Just random other floor
    let objectiveIdx = this.prng.nextInt(0, floors.length - 1);
    while (objectiveIdx === extractionIdx && floors.length > 1) {
        objectiveIdx = this.prng.nextInt(0, floors.length - 1);
    }
    const objectiveCell = floors[objectiveIdx];
    const objective: Objective = {
        id: 'obj1',
        kind: 'Recover',
        state: 'Pending',
        targetCell: { x: objectiveCell.x, y: objectiveCell.y }
    };

    // Spawn Points
    const spawnPoints: SpawnPoint[] = [];
    for (let i = 0; i < 3; i++) {
        const idx = this.prng.nextInt(0, floors.length - 1);
        const cell = floors[idx];
        spawnPoints.push({ id: `sp${i}`, pos: { x: cell.x, y: cell.y }, radius: 1 });
    }

    return {
        width,
        height,
        cells,
        extraction,
        objectives: [objective],
        spawnPoints
    };
  }
}
