import { Enemy, SpawnPoint, Vector2 } from '../shared/types';
import { PRNG } from '../shared/PRNG';

export class Director {
  private timeSinceLastSpawn: number = 0;
  private spawnInterval: number = 5000; // Initial interval
  private minSpawnInterval: number = 1000;
  private rampAmount: number = 100; // ms to reduce interval by per spawn
  
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
      this.rampDifficulty();
    }
  }

  public getThreatLevel(): number {
    const initialInterval = 5000;
    // Invert so lower interval = higher threat
    // 5000 -> 0%
    // 1000 -> 100%
    const ratio = (initialInterval - this.spawnInterval) / (initialInterval - this.minSpawnInterval);
    return Math.min(100, Math.max(0, ratio * 100));
  }

  private rampDifficulty() {
    this.spawnInterval = Math.max(this.minSpawnInterval, this.spawnInterval - this.rampAmount);
    // console.log('Director ramped difficulty. New interval:', this.spawnInterval);
  }

  private spawnEnemy() {
    if (this.spawnPoints.length === 0) return;

    // Use PRNG to pick spawn point
    const spawnIndex = this.prng.nextInt(0, this.spawnPoints.length - 1);
    const spawnPoint = this.spawnPoints[spawnIndex];

    const offsetX = this.prng.next() * 0.4 - 0.2; // -0.2 to 0.2 jitter
    const offsetY = this.prng.next() * 0.4 - 0.2;

    const enemy: Enemy = {
      id: `enemy-${this.enemyIdCounter++}`,
      pos: { x: spawnPoint.pos.x + 0.5 + offsetX, y: spawnPoint.pos.y + 0.5 + offsetY },
      hp: 30,
      maxHp: 30,
      type: 'SwarmMelee',
      damage: 5,
      fireRate: 1000,
      attackRange: 1
    };

    this.onSpawn(enemy);
  }
}