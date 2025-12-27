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
  private readonly turnDuration: number = 30000; // 30 seconds
  private readonly threatPerTurn: number = 10; // 10% per turn

  private spawnPoints: SpawnPoint[];
  private onSpawn: (enemy: Enemy) => void;
  private enemyIdCounter: number = 0;
  private prng: PRNG;
  private startingThreatLevel: number;

  constructor(
    spawnPoints: SpawnPoint[],
    prng: PRNG,
    onSpawn: (enemy: Enemy) => void,
    startingThreatLevel: number = 0,
  ) {
    this.spawnPoints = spawnPoints;
    this.prng = prng;
    this.onSpawn = onSpawn;
    this.startingThreatLevel = startingThreatLevel;

    // Initialize turn and time based on starting threat level
    // Threat = (turn + progress) * 10
    this.turn = Math.floor(startingThreatLevel / this.threatPerTurn);
    const progress = (startingThreatLevel % this.threatPerTurn) / this.threatPerTurn;
    this.timeInCurrentTurn = progress * this.turnDuration;
  }

  public preSpawn() {
    // If starting threat is > 10%, enemies are pre-spawned and autonomously roaming.
    // Each turn represents 10% threat.
    // We spawn waves for each completed 10% threat.
    const completedTurns = Math.floor(this.startingThreatLevel / this.threatPerTurn);
    
    // We only pre-spawn if we have at least one completed turn (> 10% threat)
    if (this.startingThreatLevel > 10 && completedTurns > 0) {
      // Temporarily set turn to spawn appropriate wave sizes
      const actualTurn = this.turn;
      for (let t = 0; t < completedTurns; t++) {
        this.turn = t;
        this.spawnWave();
      }
      this.turn = actualTurn;
    }
  }

  public update(dt: number) {
    this.timeInCurrentTurn += dt;

    while (this.timeInCurrentTurn >= this.turnDuration) {
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

    // Difficulty mapping: 1 (Easy), 2 (Medium), 3 (Hard)
    let difficulty = 1;
    if (type === EnemyType.WarriorDrone || type === EnemyType.SpitterAcid) {
      difficulty = 2;
    } else if (type === EnemyType.PraetorianGuard) {
      difficulty = 3;
    }

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
      fireRate: arch.fireRate * (arch.speed > 0 ? (10 / arch.speed) : 1),
      accuracy: arch.accuracy,
      attackRange: arch.attackRange,
      speed: arch.speed,
      difficulty,
    };

    this.onSpawn(enemy);
  }
}
