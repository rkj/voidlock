import { GameState, MapDefinition, Unit, Enemy, Command, CommandType, UnitState, Vector2, Objective } from '../shared/types';
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

  constructor(map: MapDefinition, seed: number) {
    this.prng = new PRNG(seed);
    this.gameGrid = new GameGrid(map);
    this.pathfinder = new Pathfinder(this.gameGrid);
    this.los = new LineOfSight(this.gameGrid);
    
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
    if (this.state.status !== 'Playing') return; // Ignore commands if game over

    if (cmd.type === CommandType.MOVE_TO) {
      cmd.unitIds.forEach(id => {
        const unit = this.state.units.find(u => u.id === id);
        if (unit && unit.pos && unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
          const path = this.pathfinder.findPath(
            { x: Math.floor(unit.pos.x), y: Math.floor(unit.pos.y) },
            cmd.target
          );
          if (path && path.length > 0) {
            unit.path = path;
            unit.targetPos = { x: path[0].x + 0.5, y: path[0].y + 0.5 }; // Set target to center of first cell in path
            unit.state = UnitState.Moving;
          } else if (path && path.length === 0 && Math.floor(unit.pos.x) === cmd.target.x && Math.floor(unit.pos.y) === cmd.target.y) {
            // Already at target, snap to center
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
      });
    }
  }

  // Helper to calculate distance between two points (centers of cells)
  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public update(dt: number) {
    if (this.state.status !== 'Playing') return;

    this.state.t += dt;

    // Update Director to spawn enemies
    this.director.update(dt);

    // --- Visibility Logic ---
    const newVisibleCells = new Set<string>();
    this.state.units.forEach(unit => {
      if (unit.hp > 0 && unit.state !== UnitState.Extracted) {
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

      // Objectives: Recover
      if (this.state.objectives) {
        this.state.objectives.forEach(obj => {
          if (obj.kind === 'Recover' && obj.state === 'Pending' && obj.targetCell) {
            // Check if unit is at target cell (integer coords)
            if (Math.floor(unit.pos.x) === obj.targetCell.x && Math.floor(unit.pos.y) === obj.targetCell.y) {
              obj.state = 'Completed';
              // console.log(`Objective ${obj.id} completed by unit ${unit.id}`);
            }
          }
        });
      }

      // Extraction
      if (this.state.map.extraction) {
        const ext = this.state.map.extraction;
        if (Math.floor(unit.pos.x) === ext.x && Math.floor(unit.pos.y) === ext.y) {
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
        unit.hp > 0 && unit.state !== UnitState.Extracted &&
        this.getDistance(enemy.pos, unit.pos) <= enemy.attackRange + 0.5
      );

      if (unitsInRange.length > 0) {
        const targetUnit = unitsInRange[0];
        targetUnit.hp -= enemy.damage;
      }
    });

    // --- Cleanup Death ---
    this.state.enemies = this.state.enemies.filter(enemy => enemy.hp > 0);
    // Mark dead units instead of removing?
    // Spec: "End: ... fail on wipe".
    // I'll keep them in array but state=Dead for now, to track them.
    this.state.units.forEach(unit => {
      if (unit.hp <= 0 && unit.state !== UnitState.Dead) {
        unit.state = UnitState.Dead;
      }
    });

    // --- Win/Loss Condition ---
    const activeUnits = this.state.units.filter(u => u.state !== UnitState.Dead && u.state !== UnitState.Extracted);
    const extractedUnits = this.state.units.filter(u => u.state === UnitState.Extracted);
    const deadUnits = this.state.units.filter(u => u.state === UnitState.Dead);

    // Loss: All units dead
    if (activeUnits.length === 0 && extractedUnits.length === 0) {
      this.state.status = 'Lost';
    }
    // End: All units extracted or dead (no active)
    else if (activeUnits.length === 0) {
      // Check objectives
      const allObjectivesComplete = this.state.objectives.every(o => o.state === 'Completed');
      if (allObjectivesComplete && extractedUnits.length > 0) {
        this.state.status = 'Won';
      } else {
        this.state.status = 'Lost'; // Failed objectives or everyone died (handled above, but this covers partial extraction fail)
      }
    }
  }
}
