import { GameState, MapDefinition, Unit, Enemy, Command, CommandType, UnitState, Vector2 } from '../shared/types';
import { GameGrid } from './GameGrid';
import { Pathfinder } from './Pathfinder';
import { Director } from './Director';
import { LineOfSight } from './LineOfSight';

const EPSILON = 0.0001; // Small value for floating-point comparisons

export class CoreEngine {
  private state: GameState;
  private gameGrid: GameGrid;
  private pathfinder: Pathfinder;
  private director: Director;
  private los: LineOfSight;
  private readonly TICK_RATE = 100; // ms

  constructor(map: MapDefinition) {
    this.gameGrid = new GameGrid(map);
    this.pathfinder = new Pathfinder(this.gameGrid);
    this.los = new LineOfSight(this.gameGrid);
    this.state = {
      t: 0,
      map,
      units: [],
      enemies: [],
      visibleCells: [],
      discoveredCells: []
    };
    
    // Initialize Director
    const spawnPoints = map.spawnPoints || [];
    this.director = new Director(spawnPoints, (enemy) => this.addEnemy(enemy));
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
    if (cmd.type === CommandType.MOVE_TO) {
      cmd.unitIds.forEach(id => {
        const unit = this.state.units.find(u => u.id === id);
        if (unit && unit.pos) {
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
    this.state.t += dt;

    // Update Director to spawn enemies
    this.director.update(dt);

    // --- Visibility Logic ---
    const newVisibleCells = new Set<string>();
    this.state.units.forEach(unit => {
      if (unit.hp > 0) {
        const visible = this.los.computeVisibleCells(unit.pos, unit.sightRange || 10); // Default sight range 10
        visible.forEach(cell => newVisibleCells.add(cell));
      }
    });
    this.state.visibleCells = Array.from(newVisibleCells);
    
    // Update discovered cells
    const discoveredSet = new Set(this.state.discoveredCells);
    newVisibleCells.forEach(cell => discoveredSet.add(cell));
    this.state.discoveredCells = Array.from(discoveredSet);


    const SPEED = 2; // Tiles per second

    // --- Unit Logic (Movement & Combat) ---
    this.state.units.forEach(unit => {
      // Prioritize combat if enemy is in range AND visible
      // Technically, if in range, might be visible, but LOS check handles walls.
      // We should check if enemy is in visibleCells?
      // Or just distance?
      // Spec says "If target in range and line-of-sight: shoot".
      // We can use visibleCells set for fast lookup.
      
      const enemiesInRange = this.state.enemies.filter(enemy => 
        enemy.hp > 0 &&
        this.getDistance(unit.pos, enemy.pos) <= unit.attackRange + 0.5 &&
        newVisibleCells.has(`${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`) // Check visibility
      );

      if (enemiesInRange.length > 0) {
        // Simple targeting: attack the first enemy in range
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
        unit.hp > 0 &&
        this.getDistance(enemy.pos, unit.pos) <= enemy.attackRange + 0.5
        // Enemies also need LOS? Usually yes.
        // For prototype, assume if soldier sees enemy, enemy sees soldier? Not always true.
        // Ideally compute enemy LOS or just distance for now.
        // Let's enforce LOS for enemies too using same LOS util if possible, or just distance for M2 simple logic.
        // Adding LOS check for enemies might be expensive if many enemies.
        // For M2, let's keep it simple: distance only for enemies (they smell you).
      );

      if (unitsInRange.length > 0) {
        // Attack the first unit in range
        const targetUnit = unitsInRange[0];
        targetUnit.hp -= enemy.damage;
      }
      
      // TODO: Enemy movement (AI)
    });

    // --- Cleanup Death ---
    this.state.enemies = this.state.enemies.filter(enemy => enemy.hp > 0);
    this.state.units = this.state.units.filter(unit => unit.hp > 0);
  }
}
