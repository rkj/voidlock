import {
  Enemy,
  SpawnPoint,
  Vector2,
  EnemyType,
  EnemyArchetypeLibrary,
} from "../shared/types";
import { PRNG } from "../shared/PRNG";

export class Director {
  private turn: number = 0;
  private timeInCurrentTurn: number = 0;
  private readonly turnDuration: number = 45000; // 45 seconds
  private readonly threatPerTurn: number = 10; // 10% per turn

  private spawnPoints: SpawnPoint[];
  private onSpawn: (enemy: Enemy) => void;
  private enemyIdCounter: number = 0;
  private prng: PRNG;

  constructor(
    spawnPoints: SpawnPoint[],
    prng: PRNG,
    onSpawn: (enemy: Enemy) => void,
  ) {
    this.spawnPoints = spawnPoints;
    this.prng = prng;
    this.onSpawn = onSpawn;
  }

  public update(dt: number) {
    this.timeInCurrentTurn += dt;

    if (this.timeInCurrentTurn >= this.turnDuration) {
      this.timeInCurrentTurn -= this.turnDuration;
      this.turn++;
      this.spawnWave();
    }
  }

  public getThreatLevel(): number {
    // Threat = 10% * (Turn + Progress)
    // Capped at Turn 10 (100%)
    // But logically, if we are at Turn 10, threat is 100%.
    // If we are at Turn 11, threat stays 100%.
    const cappedTurn = Math.min(this.turn, 10);
    const progress = this.timeInCurrentTurn / this.turnDuration;

    // If we are already at max turns (10+), threat is 100%.
    if (this.turn >= 10) return 100;

    return Math.min(100, (cappedTurn + progress) * this.threatPerTurn);
  }

  private spawnWave() {
    if (this.spawnPoints.length === 0) return;

    // Scaling: 1 base + 1 per turn.
    // Cap difficulty growth at turn 10.
    const scalingTurn = Math.min(this.turn, 10);
    const count = 1 + scalingTurn;

    for (let i = 0; i < count; i++) {
      this.spawnOneEnemy();
    }
  }

  private spawnOneEnemy() {
    const spawnIndex = this.prng.nextInt(0, this.spawnPoints.length - 1);
    const spawnPoint = this.spawnPoints[spawnIndex];

    const offsetX = this.prng.next() * 0.4 - 0.2;
    const offsetY = this.prng.next() * 0.4 - 0.2;

    // Select Type based on Threat
    const threat = this.getThreatLevel();
    let type = EnemyType.XenoMite;

    const roll = this.prng.next();

    if (threat < 30) {
      // Mostly Easy
      if (roll < 0.8) type = EnemyType.XenoMite;
      else type = EnemyType.WarriorDrone;
    } else if (threat < 70) {
      // Mix
      if (roll < 0.4) type = EnemyType.XenoMite;
      else if (roll < 0.7) type = EnemyType.WarriorDrone;
      else type = EnemyType.SpitterAcid;
    } else {
      // Hard
      if (roll < 0.3) type = EnemyType.WarriorDrone;
      else if (roll < 0.6) type = EnemyType.SpitterAcid;
      else if (roll < 0.9) type = EnemyType.PraetorianGuard;
      else type = EnemyType.XenoMite; // Swarm
    }

    const arch = EnemyArchetypeLibrary[type];

    const enemy: Enemy = {
      id: `enemy-${this.enemyIdCounter++}`,
      pos: {
        x: spawnPoint.pos.x + 0.5 + offsetX,
        y: spawnPoint.pos.y + 0.5 + offsetY,
      },
      hp: arch.hp,
      maxHp: arch.hp,
      type: arch.type,
      damage: arch.damage,
      fireRate: arch.fireRate,
      attackRange: arch.attackRange,
      speed: arch.speed,
    };

    this.onSpawn(enemy);
  }
}
