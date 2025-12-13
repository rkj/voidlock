import { GameState, MapDefinition, Unit, Enemy, Command, CommandType, UnitState, Vector2 } from '../shared/types';
import { GameGrid } from './GameGrid';
import { Pathfinder } from './Pathfinder';

const EPSILON = 0.0001; // Small value for floating-point comparisons

export class CoreEngine {
  private state: GameState;
  private gameGrid: GameGrid;
  private pathfinder: Pathfinder;
  private readonly TICK_RATE = 100; // ms

  constructor(map: MapDefinition) {
    this.gameGrid = new GameGrid(map);
    this.pathfinder = new Pathfinder(this.gameGrid);
    this.state = {
      t: 0,
      map,
      units: [],
      enemies: [] // Initialize enemies array
    };
  }

  public addUnit(unit: Unit) {
    this.state.units.push(unit);
  }

  public addEnemy(enemy: Enemy) { // New method to add enemies
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

    const SPEED = 2; // Tiles per second

    // Unit Movement & Combat Logic
    this.state.units.forEach(unit => {
      // Prioritize combat if enemy is in range
      const enemiesInRange = this.state.enemies.filter(enemy => 
        enemy.hp > 0 &&
        this.getDistance(unit.pos, enemy.pos) <= unit.attackRange + 0.5 // +0.5 to account for center-to-center distance
      );

      if (enemiesInRange.length > 0) {
        // Simple targeting: attack the first enemy in range
        const targetEnemy = enemiesInRange[0];
        targetEnemy.hp -= unit.damage;
        unit.state = UnitState.Attacking;
        // console.log(`Unit ${unit.id} attacked Enemy ${targetEnemy.id}, Enemy HP: ${targetEnemy.hp}`);
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
        unit.state = UnitState.Idle; // Ensure state is idle if not moving or attacking
      }
    });

    // Clean up defeated enemies
    this.state.enemies = this.state.enemies.filter(enemy => enemy.hp > 0);

    // TODO: Implement enemy AI and movement (will be done in a later subtask)
  }
}