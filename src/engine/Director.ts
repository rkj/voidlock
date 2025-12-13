import { Enemy, SpawnPoint, Vector2 } from '../shared/types';
import { PRNG } from '../shared/PRNG';

export class Director {
  private timeSinceLastSpawn: number = 0;
  private spawnInterval: number = 5000; // 5 seconds
  private spawnPoints: SpawnPoint[];
  private onSpawn: (enemy: Enemy) => void;
  private enemyIdCounter: number = 0;
  private prng: PRNG;

  constructor(spawnPoints: SpawnPoint[], prng: PRNG, onSpawn: (enemy: Enemy) => void) {
    this.spawnPoints = spawnPoints;
    this.prng = prng;
    this.onSpawn = onSpawn;
  }

  public update(dt: number) {
    this.timeSinceLastSpawn += dt;

    if (this.timeSinceLastSpawn >= this.spawnInterval) {
      this.timeSinceLastSpawn = 0;
      this.spawnEnemy();
    }
  }

  private spawnEnemy() {
    if (this.spawnPoints.length === 0) return;

    // Use PRNG to pick spawn point
    const spawnIndex = this.prng.nextInt(0, this.spawnPoints.length - 1);
    const spawnPoint = this.spawnPoints[spawnIndex];

    const enemy: Enemy = {
      id: `enemy-${this.enemyIdCounter++}`,
      pos: { ...spawnPoint.pos },
      hp: 30,
      maxHp: 30,
      type: 'SwarmMelee',
      damage: 5,
      attackRange: 1
    };

    this.onSpawn(enemy);
  }
}
