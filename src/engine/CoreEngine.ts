import { GameState, MapDefinition, Unit, Enemy, Command, CommandType, UnitState, Vector2, Objective, Door } from '../shared/types';
import { GameGrid } from './GameGrid';
import { Pathfinder } from './Pathfinder';
import { Director } from './Director';
import { LineOfSight } from './LineOfSight';
import { PRNG } from '../shared/PRNG';

const EPSILON = 0.0001; // Small value for floating-point comparisons

export class CoreEngine {
  private state: GameState;
  private gameGrid: GameGrid;
  private pathfinder: Pathfinder;
  private director: Director;
  private los: LineOfSight;
  private prng: PRNG;
  private readonly TICK_RATE = 100; // ms
  private doors: Map<string, Door>;

  constructor(map: MapDefinition, seed: number) {
    this.prng = new PRNG(seed);
    this.gameGrid = new GameGrid(map);
    this.doors = new Map(map.doors?.map(door => [door.id, door]));
    this.pathfinder = new Pathfinder(this.gameGrid, this.doors);
    this.los = new LineOfSight(this.gameGrid, this.doors);

    const objectives: Objective[] = (map.objectives || []).map(o => ({
      ...o,
      state: 'Pending'
    }));

    this.state = {
      t: 0,
      map,
      units: [],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      objectives,
      status: 'Playing'
    };
    
    // Initialize Director
    const spawnPoints = map.spawnPoints || [];
    this.director = new Director(spawnPoints, this.prng, (enemy) => this.addEnemy(enemy));

    // M2/M3 Prototype: Spawn default squad
    // Use extraction point as start if available, else 0,0
    const startX = map.extraction ? map.extraction.x + 0.5 : 0.5;
    const startY = map.extraction ? map.extraction.y + 0.5 : 0.5;

    this.addUnit({
      id: 's1',
      pos: { x: startX, y: startY }, 
      hp: 100, maxHp: 100,
      state: UnitState.Idle,
      damage: 20,
      attackRange: 4,
      sightRange: 8,
      commandQueue: []
    });
  }

  public clearUnits() { 
    this.state.units = [];
  }

  public addUnit(unit: Unit) {
    this.state.units.push(unit);
  }

  public addEnemy(enemy: Enemy) { 
    this.state.enemies.push(enemy);
  }

  public getState(): GameState {
    return JSON.parse(JSON.stringify(this.state)); // Return copy to ensure isolation
  }

  public applyCommand(cmd: Command) {
    if (this.state.status !== 'Playing') return; 

    if (cmd.type === CommandType.MOVE_TO) {
      cmd.unitIds.forEach(id => {
        const unit = this.state.units.find(u => u.id === id);
        if (unit) {
            if (cmd.queue) {
                unit.commandQueue.push(cmd);
            } else {
                unit.commandQueue = []; // Clear queue on new immediate command
                this.executeCommand(unit, cmd);
            }
        }
      });
    }
  }

  private executeCommand(unit: Unit, cmd: Command) {
      if (cmd.type === CommandType.MOVE_TO) {
        if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
            const path = this.pathfinder.findPath(
              { x: Math.floor(unit.pos.x), y: Math.floor(unit.pos.y) },
              cmd.target
            );
            if (path && path.length > 0) {
              unit.path = path;
              unit.targetPos = { x: path[0].x + 0.5, y: path[0].y + 0.5 }; 
              unit.state = UnitState.Moving;
            } else if (path && path.length === 0 && Math.floor(unit.pos.x) === cmd.target.x && Math.floor(unit.pos.y) === cmd.target.y) {
              // Already at target
              unit.pos = { x: cmd.target.x + 0.5, y: cmd.target.y + 0.5 };
              unit.path = undefined;
              unit.targetPos = undefined;
              unit.state = UnitState.Idle;
            } else {
              console.warn(`No path found for unit ${unit.id} to target ${cmd.target.x},${cmd.target.y}`);
              unit.path = undefined;
              unit.targetPos = undefined;
              unit.state = UnitState.Idle;
            }
        }
      }
  }

  // Helper to calculate distance between two points (centers of cells)
  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Helper to get all cells adjacent to a door's barrier segment
  private getAdjacentCellsToDoor(door: Door): Vector2[] {
    const adjacentCells: Vector2[] = [];
    door.segment.forEach(segCell => {
      const { x, y } = segCell;
      if (door.orientation === 'Vertical') { // Door between (x,y) and (x+1,y)
        adjacentCells.push({ x: x, y: y });      // Cell to the left
        adjacentCells.push({ x: x + 1, y: y });  // Cell to the right
      } else { // Horizontal, between (x,y) and (x,y+1)
        adjacentCells.push({ x: x, y: y });      // Cell above
        adjacentCells.push({ x: x, y: y + 1 });  // Cell below
      }
    });
    // Filter duplicates and invalid cells
    const uniqueCells = new Map<string, Vector2>();
    adjacentCells.forEach(cell => {
      if (cell.x >= 0 && cell.x < this.gameGrid.width && cell.y >= 0 && cell.y < this.gameGrid.height) {
        uniqueCells.set(`${cell.x},${cell.y}`, cell);
      }
    });
    return Array.from(uniqueCells.values());
  }

  // Helper to check if any unit (soldier or enemy) is adjacent to the door
  private isUnitAdjacentToDoor(door: Door): boolean {
    const adjacentCells = this.getAdjacentCellsToDoor(door);
    for (const adjCell of adjacentCells) {
      // Check units
      if (this.state.units.some(unit => 
        unit.state !== UnitState.Dead && unit.state !== UnitState.Extracted &&
        Math.floor(unit.pos.x) === adjCell.x && Math.floor(unit.pos.y) === adjCell.y)) {
        return true;
      }
      // Check enemies
      if (this.state.enemies.some(enemy => 
        enemy.hp > 0 &&
        Math.floor(enemy.pos.x) === adjCell.x && Math.floor(enemy.pos.y) === adjCell.y)) {
        return true;
      }
    }
    return false;
  }

  // Helper to check if any soldier is adjacent to the door
  private isSoldierAdjacentToDoor(door: Door): boolean {
    const adjacentCells = this.getAdjacentCellsToDoor(door);
    for (const adjCell of adjacentCells) {
      if (this.state.units.some(unit => 
        unit.state !== UnitState.Dead && unit.state !== UnitState.Extracted &&
        Math.floor(unit.pos.x) === adjCell.x && Math.floor(unit.pos.y) === adjCell.y)) {
        return true;
      }
    }
    return false;
  }

  public update(dt: number) {
    if (this.state.status !== 'Playing') return;

    this.state.t += dt;

    // Update Director to spawn enemies
    this.director.update(dt);

    // --- Automatic Door Logic ---
    this.doors.forEach(door => {
      // If door is destroyed, or already in a desired state, do nothing.
      if (door.state === 'Destroyed') return;

      // Handle door timers
      if (door.openTimer !== undefined && door.openTimer > 0) {
        door.openTimer -= dt;
        if (door.openTimer <= 0) {
          door.state = door.targetState!; // Apply target state
          door.openTimer = undefined;
          door.targetState = undefined;
        }
        return; // If timer is active, wait for it to complete
      }

      const unitAdjacent = this.isUnitAdjacentToDoor(door);
      const soldierAdjacent = this.isSoldierAdjacentToDoor(door);
      
      if (unitAdjacent) {
        if (door.state === 'Closed' || (door.state === 'Locked' && soldierAdjacent)) {
          // Locked doors open for soldiers
          door.targetState = 'Open';
          door.openTimer = door.openDuration * 1000;
        }
      } else { // No units adjacent
        if (door.state === 'Open') {
          door.targetState = 'Closed';
          door.openTimer = door.openDuration * 1000;
        }
      }    });

    // --- Visibility Logic ---
    const newVisibleCells = new Set<string>();
    this.state.units.forEach(unit => {
      if (unit.hp > 0 && unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        const visible = this.los.computeVisibleCells(unit.pos, unit.sightRange || 10); 
        visible.forEach(cell => newVisibleCells.add(cell));
      }
    });
    this.state.visibleCells = Array.from(newVisibleCells);
    
    // Update discovered cells
    const discoveredSet = new Set(this.state.discoveredCells);
    newVisibleCells.forEach(cell => discoveredSet.add(cell));
    this.state.discoveredCells = Array.from(discoveredSet);


    const SPEED = 2; // Tiles per second

    // --- Unit Logic (Movement & Combat & Objectives) ---
    this.state.units.forEach(unit => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead) return;

      // Process Queue if Idle
      if (unit.state === UnitState.Idle && unit.commandQueue.length > 0) {
          const nextCmd = unit.commandQueue.shift();
          if (nextCmd) {
              this.executeCommand(unit, nextCmd);
          }
      }

      // Objectives: Recover
      if (this.state.objectives) {
        this.state.objectives.forEach(obj => {
          if (obj.kind === 'Recover' && obj.state === 'Pending' && obj.targetCell) {
            // Check if unit is at target cell (integer coords)
            if (Math.floor(unit.pos.x) === obj.targetCell.x && Math.floor(unit.pos.y) === obj.targetCell.y) {
              obj.state = 'Completed';
            }
          }
        });
      }

      // Extraction
      if (this.state.map.extraction) {
        const ext = this.state.map.extraction;
        // Only extract if objectives are complete
        const allObjectivesComplete = this.state.objectives.every(o => o.state === 'Completed');
        
        if (allObjectivesComplete && Math.floor(unit.pos.x) === ext.x && Math.floor(unit.pos.y) === ext.y) {
          unit.state = UnitState.Extracted;
          unit.path = undefined;
          unit.targetPos = undefined;
          return; // Skip rest of logic
        }
      }

      // Combat
      const enemiesInRange = this.state.enemies.filter(enemy => 
        enemy.hp > 0 &&
        this.getDistance(unit.pos, enemy.pos) <= unit.attackRange + 0.5 &&
        newVisibleCells.has(`${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`) 
      );

      if (enemiesInRange.length > 0) {
        const targetEnemy = enemiesInRange[0];
        targetEnemy.hp -= unit.damage;
        unit.state = UnitState.Attacking;
        
        // Record attack for visuals
        unit.lastAttackTarget = { ...targetEnemy.pos };
        unit.lastAttackTime = this.state.t;

      } else if (unit.state === UnitState.Moving && unit.targetPos && unit.path) {
        // Movement logic
        const dx = unit.targetPos.x - unit.pos.x;
        const dy = unit.targetPos.y - unit.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const moveDist = (SPEED * dt) / 1000;

        if (dist <= moveDist + EPSILON) { 
          unit.pos = { ...unit.targetPos };
          unit.path.shift();

          if (unit.path.length === 0) {
            unit.path = undefined;
            unit.targetPos = undefined;
            unit.state = UnitState.Idle;
          } else {
            unit.targetPos = { x: unit.path[0].x + 0.5, y: unit.path[0].y + 0.5 };
          }
        } else {
          unit.pos.x += (dx / dist) * moveDist;
          unit.pos.y += (dy / dist) * moveDist;
        }
      } else {
        unit.state = UnitState.Idle;
      }
    });

    // --- Enemy Logic (Simple Retaliation) ---
    this.state.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;

      const unitsInRange = this.state.units.filter(unit => 
        unit.hp > 0 && unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead &&
        this.getDistance(enemy.pos, unit.pos) <= enemy.attackRange + 0.5
      );

      if (unitsInRange.length > 0) {
        const targetUnit = unitsInRange[0];
        targetUnit.hp -= enemy.damage;
        
        // Record attack for visuals (optional for enemies?)
        // Let's add it for consistency
        enemy.lastAttackTarget = { ...targetUnit.pos };
        enemy.lastAttackTime = this.state.t;
      }
    });

    // --- Cleanup Death ---
    this.state.enemies = this.state.enemies.filter(enemy => enemy.hp > 0);
    this.state.units.forEach(unit => {
      if (unit.hp <= 0 && unit.state !== UnitState.Dead) {
        unit.state = UnitState.Dead;
      }
    });

    // --- Win/Loss Condition ---
    const activeUnits = this.state.units.filter(u => u.state !== UnitState.Dead && u.state !== UnitState.Extracted);
    const extractedUnits = this.state.units.filter(u => u.state === UnitState.Extracted);
    
    if (activeUnits.length === 0) {
      const allObjectivesComplete = this.state.objectives.every(o => o.state === 'Completed');
      if (allObjectivesComplete && extractedUnits.length > 0) {
        this.state.status = 'Won';
      } else {
        this.state.status = 'Lost'; 
      }
    }
  }
}