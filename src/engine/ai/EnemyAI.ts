import { GameState, Enemy, Unit, UnitState, Vector2, Grid, CommandType } from '../../shared/types';
import { Pathfinder } from '../Pathfinder';
import { PRNG } from '../../shared/PRNG';
import { LineOfSight } from '../LineOfSight';

export interface IEnemyAI {
    think(enemy: Enemy, state: GameState, grid: Grid, pathfinder: Pathfinder, los: LineOfSight, prng: PRNG): void;
}

export class SwarmMeleeAI implements IEnemyAI {
    think(enemy: Enemy, state: GameState, grid: Grid, pathfinder: Pathfinder, los: LineOfSight, prng: PRNG): void {
        if (enemy.hp <= 0) return;

        // 1. Detection: Find closest visible soldier
        const visibleSoldiers = state.units.filter(u => 
            u.hp > 0 && 
            u.state !== UnitState.Extracted && 
            u.state !== UnitState.Dead &&
            this.getDistance(enemy.pos, u.pos) <= 10 && // Detection radius
            los.hasLineOfSight(enemy.pos, u.pos)
        );

        let targetSoldier: Unit | null = null;
        let minDistance = Infinity;

        visibleSoldiers.forEach(u => {
            const dist = this.getDistance(enemy.pos, u.pos);
            if (dist < minDistance) {
                minDistance = dist;
                targetSoldier = u;
            }
        });

        if (targetSoldier) {
            // 2. Attack Mode: Pathfind to soldier
            const targetPos = (targetSoldier as Unit).pos;
            const path = pathfinder.findPath(
                { x: Math.floor(enemy.pos.x), y: Math.floor(enemy.pos.y) },
                { x: Math.floor(targetPos.x), y: Math.floor(targetPos.y) }
            );

            if (path && path.length > 0) {
                enemy.path = path;
                enemy.targetPos = { x: path[0].x + 0.5, y: path[0].y + 0.5 };
            }
        } else {
            // 3. Roam Mode: If idle and no target, pick random neighbor cell
            if ((!enemy.path || enemy.path.length === 0) && !enemy.targetPos) {
                const currentX = Math.floor(enemy.pos.x);
                const currentY = Math.floor(enemy.pos.y);
                
                const neighbors = [
                    { x: currentX + 1, y: currentY },
                    { x: currentX - 1, y: currentY },
                    { x: currentX, y: currentY + 1 },
                    { x: currentX, y: currentY - 1 }
                ].filter(n => 
                    grid.isWalkable(n.x, n.y) && 
                    grid.canMove(currentX, currentY, n.x, n.y)
                );

                if (neighbors.length > 0) {
                    const target = neighbors[prng.nextInt(0, neighbors.length - 1)];
                    enemy.targetPos = { x: target.x + 0.5, y: target.y + 0.5 };
                    enemy.path = [target];
                }
            }
        }
    }

    private getDistance(p1: Vector2, p2: Vector2): number {
        return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
    }
}
