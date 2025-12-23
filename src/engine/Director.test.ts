import { describe, it, expect, vi } from 'vitest';
import { Director } from './Director';
import { SpawnPoint, Enemy, EnemyType } from '../shared/types';
import { PRNG } from '../shared/PRNG';

describe('Director', () => {
  it('should spawn enemies periodically', () => {
    const spawnPoints: SpawnPoint[] = [
      { id: 'sp1', pos: { x: 5, y: 5 }, radius: 1 }
    ];
    const onSpawn = vi.fn();
    const prng = new PRNG(123);
    const director = new Director(spawnPoints, prng, onSpawn);

    // Update less than spawn interval (5000ms)
    director.update(1000);
    expect(onSpawn).not.toHaveBeenCalled();

    // Update to cross threshold
    director.update(4000); // Total 5000ms
    expect(onSpawn).toHaveBeenCalledTimes(1);
    
    const spawnedEnemy = onSpawn.mock.calls[0][0] as Enemy;
    // Check if the type is one of the valid enemy types
    expect(Object.values(EnemyType).includes(spawnedEnemy.type as EnemyType)).toBe(true);
    
    // Enemy can spawn anywhere inside the square on which the spawner is (plus jitter logic)
    expect(spawnedEnemy.pos.x).toBeGreaterThanOrEqual(5);
    expect(spawnedEnemy.pos.x).toBeLessThan(6);
    expect(spawnedEnemy.pos.y).toBeGreaterThanOrEqual(5);
    expect(spawnedEnemy.pos.y).toBeLessThan(6);
  });

  it('should not spawn if no spawn points', () => {
    const onSpawn = vi.fn();
    const prng = new PRNG(123);
    const director = new Director([], prng, onSpawn);

    director.update(6000);
    expect(onSpawn).not.toHaveBeenCalled();
  });

  it('should ramp up difficulty (spawn faster)', () => {
    const spawnPoints: SpawnPoint[] = [
      { id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 }
    ];
    const onSpawn = vi.fn();
    const prng = new PRNG(123);
    const director = new Director(spawnPoints, prng, onSpawn);

    // 1st Spawn at 5000ms
    director.update(5000);
    expect(onSpawn).toHaveBeenCalledTimes(1);

    // 2nd Spawn should be at +4900ms (9900ms total)
    // Update by 4800ms (total 9800) -> should NOT spawn yet
    director.update(4800);
    expect(onSpawn).toHaveBeenCalledTimes(1);

    // Update by 100ms (total 9900) -> should spawn
    director.update(100);
    expect(onSpawn).toHaveBeenCalledTimes(2);
  });

  it('should increase threat level as difficulty ramps up', () => {
    const spawnPoints: SpawnPoint[] = [{ id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 }];
    const onSpawn = vi.fn();
    const prng = new PRNG(123);
    const director = new Director(spawnPoints, prng, onSpawn);

    // Initial threat level should be 0
    expect(director.getThreatLevel()).toBe(0);

    // After 1st spawn, interval drops from 5000 to 4900
    // Threat = (5000 - 4900) / (5000 - 1000) = 100 / 4000 = 2.5%
    director.update(5000);
    expect(director.getThreatLevel()).toBe(2.5);

    // After many spawns (e.g. 20 more), interval drops further
    for (let i = 0; i < 20; i++) {
        // We need to advance enough time for next spawn.
        // Current interval is reducing. To be safe, advance 5000ms each time.
        director.update(5000); 
    }
    
    // Total spawns: 1 + 20 = 21.
    // Interval decrease: 21 * 100 = 2100ms.
    // Current interval: 5000 - 2100 = 2900ms.
    // Threat: (5000 - 2900) / 4000 = 2100 / 4000 = 52.5%
    expect(director.getThreatLevel()).toBe(52.5);
  });
});
