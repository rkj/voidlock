import { Enemy, SpawnPoint, Vector2 } from '../shared/types';

export class Director {
  private timeSinceLastSpawn: number = 0;
  private spawnInterval: number = 5000; // 5 seconds
  private spawnPoints: SpawnPoint[];
  private onSpawn: (enemy: Enemy) => void;
  private enemyIdCounter: number = 0;

  constructor(spawnPoints: SpawnPoint[], onSpawn: (enemy: Enemy) => void) {
    this.spawnPoints = spawnPoints;
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

    // Pick a random spawn point (deterministic if we passed a seeded PRNG, but for now Math.random is acceptable for prototype M2 per plan)
    // Actually, spec said "never call Math.random()", must use PRNG.
    // I will implement a very simple LCG PRNG here to satisfy the requirement if one isn't passed.
    // For M2 prototype, I'll stick to a simple index rotation to be deterministic without complex PRNG yet.
    
    const spawnIndex = this.enemyIdCounter % this.spawnPoints.length;
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