import {
  Enemy,
  SpawnPoint,
  Vector2,
  EnemyType,
  EnemyArchetypeLibrary,
  GameState,
  UseItemCommand,
  MapDefinition,
  CellType,
  UnitState,
  MissionType,
} from "../shared/types";
import { PRNG } from "../shared/PRNG";
import { IDirector, ItemEffectHandler } from "./interfaces/IDirector";
import {
  DIRECTOR,
  SPEED_NORMALIZATION_CONST,
} from "./config/GameConstants";
import { MathUtils } from "../shared/utils/MathUtils";

export class Director implements IDirector {
  private turn: number = 0;
  private timeInCurrentTurn: number = 0;
  private readonly turnDuration: number = DIRECTOR.TURN_DURATION_MS;
  private readonly threatPerTurn: number = DIRECTOR.THREAT_PER_TURN;

  private spawnPoints: SpawnPoint[];
  private onSpawn: (enemy: Enemy) => void;
  private enemyIdCounter: number = 0;
  private prng: PRNG;
  private startingThreatLevel: number;
  private map?: MapDefinition;
  private startingPoints: number;
  private missionType: MissionType;

  private itemEffectService: ItemEffectHandler;

  constructor(
    spawnPoints: SpawnPoint[],
    prng: PRNG,
    onSpawn: (enemy: Enemy) => void,
    itemEffectService: ItemEffectHandler,
    startingThreatLevel: number = 0,
    map?: MapDefinition,
    startingPoints: number = DIRECTOR.STARTING_POINTS,
    missionType: MissionType = MissionType.Default,
  ) {
    this.spawnPoints = spawnPoints;
    this.prng = prng;
    this.onSpawn = onSpawn;
    this.itemEffectService = itemEffectService;
    this.startingThreatLevel = startingThreatLevel;
    this.map = map;
    this.startingPoints = startingPoints;
    this.missionType = missionType;

    // Initialize turn and time based on starting threat level
    // Threat = (turn + progress) * 10
    this.turn = Math.floor(startingThreatLevel / this.threatPerTurn);
    const progress =
      (startingThreatLevel % this.threatPerTurn) / this.threatPerTurn;
    this.timeInCurrentTurn = progress * this.turnDuration;
  }

  public getState() {
    return {
      turn: this.turn,
      timeInCurrentTurn: this.timeInCurrentTurn,
      enemyIdCounter: this.enemyIdCounter,
    };
  }

  public setState(state: {
    turn: number;
    timeInCurrentTurn: number;
    enemyIdCounter: number;
  }) {
    this.turn = state.turn;
    this.timeInCurrentTurn = state.timeInCurrentTurn;
    this.enemyIdCounter = state.enemyIdCounter;
  }

  public preSpawn() {
    if (this.missionType === MissionType.Prologue) {
      if (this.spawnPoints.length > 0) {
        const spawnPoint = this.spawnPoints[0];
        const jitter = MathUtils.getDeterministicJitter(this.enemyIdCounter);
        const pos = {
          x: spawnPoint.pos.x + 0.5 + jitter.x,
          y: spawnPoint.pos.y + 0.5 + jitter.y,
        };
        const enemy = this.createEnemy(
          `tutorial-enemy`,
          pos,
          EnemyType.Tutorial,
          1,
        );
        this.onSpawn(enemy);
      }
      return;
    }
    // 1. Spend Starting Points Budget (Pre-spawning at mission start)
    // Placement: Rooms only, NOT in player quadrant.
    if (this.startingPoints > 0 && this.map) {
      this.preSpawnFromPoints();
    }

    // 2. Legacy pre-spawning based on starting threat (if any)
    // If starting threat is > 10%, enemies are pre-spawned and autonomously roaming.
    const completedTurns = Math.floor(
      this.startingThreatLevel / this.threatPerTurn,
    );

    if (this.startingThreatLevel >= 10 && completedTurns > 0) {
      const actualTurn = this.turn;
      for (let t = 1; t <= completedTurns; t++) {
        this.turn = t;
        this.spawnWave();
      }
      this.turn = actualTurn;
    }
  }

  private preSpawnFromPoints() {
    if (!this.map) return;

    const midX = this.map.width / 2;
    const midY = this.map.height / 2;

    const getQuadrant = (pos: Vector2) => {
      if (pos.x < midX && pos.y < midY) return 0;
      if (pos.x >= midX && pos.y < midY) return 1;
      if (pos.x < midX && pos.y >= midY) return 2;
      return 3;
    };

    const playerQuads = new Set<number>();
    if (this.map.squadSpawn) playerQuads.add(getQuadrant(this.map.squadSpawn));
    if (this.map.squadSpawns) {
      this.map.squadSpawns.forEach((ss) => playerQuads.add(getQuadrant(ss)));
    }

    const validRoomCells = this.map.cells.filter((c) => {
      if (c.type !== CellType.Floor || !c.roomId) return false;
      if (c.roomId.startsWith("corridor-")) return false;
      const q = getQuadrant(c);
      return !playerQuads.has(q);
    });

    if (validRoomCells.length === 0) return;

    let budget = this.startingPoints;
    while (budget > 0) {
      // Pre-spawning at threat 0
      const type = this.selectEnemyTypeForThreat(0, budget);
      if (!type) break;

      const difficulty = this.getDifficultyForType(type);
      if (difficulty > budget) break;

      const cell =
        validRoomCells[this.prng.nextInt(0, validRoomCells.length - 1)];

      const jitter = MathUtils.getDeterministicJitter(this.enemyIdCounter);

      const pos = {
        x: cell.x + 0.5 + jitter.x,
        y: cell.y + 0.5 + jitter.y,
      };

      const enemy = this.createEnemy(
        `enemy-pre-${this.enemyIdCounter++}`,
        pos,
        type,
        difficulty,
      );
      this.onSpawn(enemy);
      budget -= difficulty;
    }
  }

  public update(dt: number) {
    if (this.missionType === MissionType.Prologue) return;
    this.timeInCurrentTurn += dt;

    while (this.timeInCurrentTurn >= this.turnDuration) {
      this.timeInCurrentTurn -= this.turnDuration;
      this.turn++;
      this.spawnWave();
    }
  }

  public getThreatLevel(): number {
    const progress = this.timeInCurrentTurn / this.turnDuration;
    return (this.turn + progress) * this.threatPerTurn;
  }

  public handleUseItem(state: GameState, cmd: UseItemCommand) {
    this.itemEffectService.handleUseItem(state, cmd);
  }

  private spawnWave() {
    if (this.spawnPoints.length === 0 || this.turn === 0) return;

    // Formula: WaveBudget = floor((CurrentThreat/10 * PointGrowthRate))

    // Use turn-based threat to ensure discrete scaling at every 10% boundary

    const currentThreat = this.turn * this.threatPerTurn;

    const budget = Math.floor(
      (currentThreat / 10) * DIRECTOR.POINT_GROWTH_RATE,
    );

    let remainingBudget = budget;

    let spawnedInWave = 0;

    // Tier Locking:

    // Threat < THREAT_LOW: Only weak enemies allowed.

    // Threat THREAT_LOW to THREAT_HIGH: Up to medium enemies allowed.

    // Threat > THREAT_HIGH: All archetypes allowed.

    while (remainingBudget > 0 && spawnedInWave < DIRECTOR.WAVE_CAP) {
      const type = this.selectEnemyTypeForThreat(
        currentThreat,
        remainingBudget,
      );

      if (!type) break;

      const difficulty = this.getDifficultyForType(type);

      if (difficulty > remainingBudget) break;

      this.spawnOneEnemyOfType(type, difficulty);

      remainingBudget -= difficulty;

      spawnedInWave++;
    }
  }

  private selectEnemyTypeForThreat(
    threat: number,

    budget: number,
  ): EnemyType | null {
    // Define available types based on threat tiers

    let availableTypes: { type: EnemyType; cost: number }[] = [];

    if (threat < DIRECTOR.THREAT_LOW) {
      // Tier 1: Only weak enemies

      availableTypes = [
        { type: EnemyType.XenoMite, cost: DIRECTOR.DIFFICULTY_EASY },
      ];
    } else if (threat < DIRECTOR.THREAT_HIGH) {
      // Tier 2: Up to medium enemies

      availableTypes = [
        { type: EnemyType.XenoMite, cost: DIRECTOR.DIFFICULTY_EASY },

        { type: EnemyType.WarriorDrone, cost: DIRECTOR.DIFFICULTY_MEDIUM },

        { type: EnemyType.SpitterAcid, cost: DIRECTOR.DIFFICULTY_MEDIUM },

        { type: EnemyType.PraetorianGuard, cost: DIRECTOR.DIFFICULTY_HARD },
      ];
    } else {
      // Tier 3: All archetypes

      availableTypes = [
        { type: EnemyType.XenoMite, cost: DIRECTOR.DIFFICULTY_EASY },

        { type: EnemyType.WarriorDrone, cost: DIRECTOR.DIFFICULTY_MEDIUM },

        { type: EnemyType.SpitterAcid, cost: DIRECTOR.DIFFICULTY_MEDIUM },

        { type: EnemyType.PraetorianGuard, cost: DIRECTOR.DIFFICULTY_HARD },

        { type: EnemyType.SwarmMelee, cost: DIRECTOR.DIFFICULTY_EASY },
      ];
    }

    // Filter by what we can afford
    const affordable = availableTypes.filter((a) => a.cost <= budget);
    if (affordable.length === 0) return null;

    // Pick a random type from affordable list
    // Use weighted selection similar to original intent but restricted to affordable
    if (threat < DIRECTOR.THREAT_LOW) {
      return EnemyType.XenoMite;
    } else {
      // Weighted among affordable
      if (affordable.length === 1) return affordable[0].type;

      // Simple uniform selection among affordable for now to guarantee spending budget,
      // or we could implement a better weighted shuffle.
      // Actually, let's just pick one randomly from affordable.
      return affordable[this.prng.nextInt(0, affordable.length - 1)].type;
    }
  }
  private getDifficultyForType(type: EnemyType): number {
    if (type === EnemyType.WarriorDrone || type === EnemyType.SpitterAcid) {
      return DIRECTOR.DIFFICULTY_MEDIUM;
    } else if (type === EnemyType.PraetorianGuard) {
      return DIRECTOR.DIFFICULTY_HARD;
    }
    return DIRECTOR.DIFFICULTY_EASY;
  }

  private createEnemy(
    id: string,
    pos: Vector2,
    type: EnemyType,
    difficulty: number,
  ): Enemy {
    const arch = EnemyArchetypeLibrary[type];
    const jitter = MathUtils.getDeterministicJitter(this.enemyIdCounter);
    return {
      id,
      pos,
      visualJitter: jitter,
      hp: arch.hp,
      maxHp: arch.hp,
      type: arch.type,
      damage: arch.damage,
      fireRate:
        arch.fireRate *
        (arch.speed > 0 ? SPEED_NORMALIZATION_CONST / arch.speed : 1),
      accuracy: arch.accuracy,
      attackRange: arch.attackRange,
      speed: arch.speed,
      difficulty,
      state: UnitState.Idle,
    };
  }

  private spawnOneEnemyOfType(type: EnemyType, difficulty: number) {
    const spawnIndex = this.prng.nextInt(0, this.spawnPoints.length - 1);
    const spawnPoint = this.spawnPoints[spawnIndex];

    const jitter = MathUtils.getDeterministicJitter(this.enemyIdCounter);

    const pos = {
      x: spawnPoint.pos.x + 0.5 + jitter.x,
      y: spawnPoint.pos.y + 0.5 + jitter.y,
    };

    const enemy = this.createEnemy(
      `enemy-${this.enemyIdCounter++}`,
      pos,
      type,
      difficulty,
    );
    this.onSpawn(enemy);
  }
}
