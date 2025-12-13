import { GameState, MapDefinition, Unit, Command, CommandType, UnitState, Vector2 } from '../shared/types';
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
      units: []
    };
  }

  public addUnit(unit: Unit) {
    this.state.units.push(unit);
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

  public update(dt: number) {
    this.state.t += dt;

    const SPEED = 2; // Tiles per second

    this.state.units.forEach(unit => {
      if (unit.state === UnitState.Moving && unit.targetPos && unit.path) {
        // Calculate distance to current segment target
        const dx = unit.targetPos.x - unit.pos.x;
        const dy = unit.targetPos.y - unit.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const moveDist = (SPEED * dt) / 1000;

        // Use EPSILON for floating point comparison
        if (dist <= moveDist + EPSILON) { // If we are very close or would overshoot, snap
          // Snap to current segment target and advance to next path segment
          unit.pos = { ...unit.targetPos };
          unit.path.shift();

          if (unit.path.length === 0) {
            // Arrived at final destination
            unit.path = undefined; // Explicitly set to undefined
            unit.targetPos = undefined;
            unit.state = UnitState.Idle;
          } else {
            // Set new target to center of next cell in path
            unit.targetPos = { x: unit.path[0].x + 0.5, y: unit.path[0].y + 0.5 };
          }
        } else {
          // Move towards current segment target
          unit.pos.x += (dx / dist) * moveDist;
          unit.pos.y += (dy / dist) * moveDist;
        }
      }
    });
  }
}