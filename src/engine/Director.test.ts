import { describe, it, expect, vi } from 'vitest';
import { Director } from './Director';
import { SpawnPoint, Enemy } from '../shared/types';
import { PRNG } from '../shared/PRNG';

describe('Director', () => {
  it('should spawn enemies periodically', () => {
    const spawnPoints: SpawnPoint[] = [
      { id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 }
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
    expect(spawnedEnemy.type).toBe('SwarmMelee');
    expect(spawnedEnemy.pos).toEqual({ x: 0, y: 0 });
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
});
