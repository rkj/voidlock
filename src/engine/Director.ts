import {
  Enemy,
  SpawnPoint,
  Vector2,
  EnemyType,
  EnemyArchetypeLibrary,
  GameState,
  ItemLibrary,
  UseItemCommand,
  MapDefinition,
  CellType,
} from "../shared/types";
import { PRNG } from "../shared/PRNG";
import { IDirector } from "./interfaces/IDirector";
import {
  DIRECTOR,
  ITEMS,
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
  private baseEnemyCount: number;
  private enemyGrowthPerMission: number;
  private missionDepth: number;
  private map?: MapDefinition;
  private startingPoints: number;

  constructor(
    spawnPoints: SpawnPoint[],
    prng: PRNG,
    onSpawn: (enemy: Enemy) => void,
    startingThreatLevel: number = 0,
    baseEnemyCount: number = 3,
    enemyGrowthPerMission: number = 1,
    missionDepth: number = 0,
    map?: MapDefinition,
    startingPoints: number = DIRECTOR.STARTING_POINTS,
  ) {
    this.spawnPoints = spawnPoints;
    this.prng = prng;
    this.onSpawn = onSpawn;
    this.startingThreatLevel = startingThreatLevel;
    this.baseEnemyCount = baseEnemyCount;
    this.enemyGrowthPerMission = enemyGrowthPerMission;
    this.missionDepth = missionDepth;
    this.map = map;
    this.startingPoints = startingPoints;

    // Initialize turn and time based on starting threat level
    // Threat = (turn + progress) * 10
    this.turn = Math.floor(startingThreatLevel / this.threatPerTurn);
    const progress =
      (startingThreatLevel % this.threatPerTurn) / this.threatPerTurn;
    this.timeInCurrentTurn = progress * this.turnDuration;
  }

  public preSpawn() {
    // 1. Spend Starting Points Budget (Pre-spawning at mission start)
    // Placement: Rooms only, NOT in player quadrant.
    if (this.startingPoints > 0 && this.map) {
      this.preSpawnFromPoints();
    }

    // 2. Legacy pre-spawning based on starting threat (if any)
    // If starting threat is > 10%, enemies are pre-spawned and autonomously roaming.
    // Each turn represents 10% threat.
    // We spawn waves for each completed 10% threat.
    const completedTurns = Math.floor(
      this.startingThreatLevel / this.threatPerTurn,
    );

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

    // Identify valid rooms (not in player quadrants, not corridors)
    const validRoomCells = this.map.cells.filter((c) => {
      if (c.type !== CellType.Floor || !c.roomId) return false;
      if (c.roomId.startsWith("corridor-")) return false;
      const q = getQuadrant(c);
      return !playerQuads.has(q);
    });

    if (validRoomCells.length === 0) return;

    let budget = this.startingPoints;
    const archs = [
      { type: EnemyType.PraetorianGuard, cost: DIRECTOR.DIFFICULTY_HARD },
      { type: EnemyType.SpitterAcid, cost: DIRECTOR.DIFFICULTY_MEDIUM },
      { type: EnemyType.WarriorDrone, cost: DIRECTOR.DIFFICULTY_MEDIUM },
      { type: EnemyType.XenoMite, cost: DIRECTOR.DIFFICULTY_EASY },
    ];

    while (budget > 0) {
      // Filter archetypes we can afford
      const affordable = archs.filter((a) => a.cost <= budget);
      if (affordable.length === 0) break;

      // Simple selection: pick based on threat level 0 (easy-leaning)
      const typeRoll = this.prng.next();
      let selected;
      if (typeRoll < 0.6) {
        selected = affordable[affordable.length - 1]; // XenoMite
      } else if (typeRoll < 0.9) {
        selected = affordable.find(
          (a) => a.cost === DIRECTOR.DIFFICULTY_MEDIUM,
        );
      } else {
        selected = affordable.find((a) => a.cost === DIRECTOR.DIFFICULTY_HARD);
      }

      if (!selected) selected = affordable[this.prng.nextInt(0, affordable.length - 1)];

      const cell =
        validRoomCells[this.prng.nextInt(0, validRoomCells.length - 1)];
      
      const offsetX = this.prng.next() * 0.4 - 0.2;
      const offsetY = this.prng.next() * 0.4 - 0.2;

      const arch = EnemyArchetypeLibrary[selected.type];
      const enemy: Enemy = {
        id: `enemy-pre-${this.enemyIdCounter++}`,
        pos: {
          x: cell.x + 0.5 + offsetX,
          y: cell.y + 0.5 + offsetY,
        },
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
        difficulty: selected.cost,
      };

      this.onSpawn(enemy);
      budget -= selected.cost;
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
    // No longer capped at 100% in the state, but logic that uses it should cap as needed.
    const progress = this.timeInCurrentTurn / this.turnDuration;
    return (this.turn + progress) * this.threatPerTurn;
  }

  public handleUseItem(state: GameState, cmd: UseItemCommand) {
    const item = ItemLibrary[cmd.itemId];
    if (!item) return;

    if (item.action === "Heal") {
      let targetUnitId = cmd.targetUnitId;
      // Medkit and Stimpack are now strictly self-heal
      if (cmd.itemId === "medkit" || cmd.itemId === "stimpack") {
        targetUnitId = cmd.unitIds[0];
      }

      if (targetUnitId) {
        const targetUnit = state.units.find((u) => u.id === targetUnitId);
        if (targetUnit && targetUnit.hp > 0) {
          targetUnit.hp = Math.min(
            targetUnit.maxHp,
            targetUnit.hp + (item.healAmount || ITEMS.DEFAULT_HEAL),
          );
        }
      }
    } else if (item.action === "Grenade") {
      let targetPos: Vector2 | undefined = cmd.target;

      if (cmd.targetUnitId) {
        const targetEnemy = state.enemies.find(
          (e) => e.id === cmd.targetUnitId,
        );
        if (targetEnemy) {
          targetPos = {
            x: Math.floor(targetEnemy.pos.x),
            y: Math.floor(targetEnemy.pos.y),
          };
        }
      }

      if (targetPos) {
        const targetX = Math.floor(targetPos.x);
        const targetY = Math.floor(targetPos.y);

        state.enemies.forEach((e) => {
          if (
            Math.floor(e.pos.x) === targetX &&
            Math.floor(e.pos.y) === targetY
          ) {
            e.hp -= ITEMS.GRENADE_DAMAGE;
          }
        });

        state.units.forEach((u) => {
          if (
            Math.floor(u.pos.x) === targetX &&
            Math.floor(u.pos.y) === targetY
          ) {
            u.hp -= ITEMS.GRENADE_DAMAGE;
          }
        });
      }
    } else if (item.action === "Scanner") {
      let targetPos: Vector2 | undefined = cmd.target;

      if (cmd.targetUnitId) {
        const targetUnit = state.units.find((u) => u.id === cmd.targetUnitId);
        if (targetUnit) {
          targetPos = {
            x: Math.floor(targetUnit.pos.x),
            y: Math.floor(targetUnit.pos.y),
          };
        }
      }

      if (targetPos) {
        const radius = DIRECTOR.SCANNER_RADIUS;
        const radiusSq = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (
              MathUtils.getDistanceSquared({ x: dx, y: dy }, { x: 0, y: 0 }) <=
              radiusSq
            ) {
              const tx = Math.floor(targetPos.x + dx);
              const ty = Math.floor(targetPos.y + dy);
              if (
                tx >= 0 &&
                tx < state.map.width &&
                ty >= 0 &&
                ty < state.map.height
              ) {
                if (state.gridState) {
                  state.gridState[ty * state.map.width + tx] |= 2;
                }
                const key = `${tx},${ty}`;
                if (!state.discoveredCells.includes(key)) {
                  state.discoveredCells.push(key);
                }
              }
            }
          }
        }
      }
    } else if (item.action === "Mine") {
      if (cmd.target) {
        state.mines = [
          ...state.mines,
          {
            id: `mine-${state.t}`,
            pos: { ...cmd.target },
            damage: ITEMS.MINE_DAMAGE,
            radius: ITEMS.MINE_RADIUS,
            ownerId: cmd.unitIds[0] || "squad",
          },
        ];
      }
    } else if (item.action === "Sentry") {
      if (cmd.target) {
        state.turrets = [
          ...state.turrets,
          {
            id: `turret-${state.t}`,
            pos: { ...cmd.target },
            damage: item.damage || ITEMS.SENTRY_DEFAULT_DAMAGE,
            fireRate: item.fireRate || ITEMS.SENTRY_DEFAULT_FIRE_RATE,
            accuracy: item.accuracy || ITEMS.SENTRY_DEFAULT_ACCURACY,
            attackRange: item.range || ITEMS.SENTRY_DEFAULT_RANGE,
            ownerId: cmd.unitIds[0] || "squad",
          },
        ];
      }
    }
  }

  private spawnWave() {
    if (this.spawnPoints.length === 0) return;

    // Scaling: (base + depth * growth) + per turn.
    // Cap turn scaling at turn 10.
    const scalingTurn = Math.min(this.turn, DIRECTOR.MAX_SCALING_TURNS);
    const count =
      this.baseEnemyCount +
      this.missionDepth * this.enemyGrowthPerMission +
      scalingTurn;

    for (let i = 0; i < count; i++) {
      this.spawnOneEnemy();
    }
  }

  private spawnOneEnemy() {
    const spawnIndex = this.prng.nextInt(0, this.spawnPoints.length - 1);
    const spawnPoint = this.spawnPoints[spawnIndex];

    const offsetX =
      this.prng.next() * DIRECTOR.SPAWN_OFFSET_RANGE -
      DIRECTOR.SPAWN_OFFSET_BASE;
    const offsetY =
      this.prng.next() * DIRECTOR.SPAWN_OFFSET_RANGE -
      DIRECTOR.SPAWN_OFFSET_BASE;

    // Select Type based on Threat (capped at 100 for selection logic)
    const threat = Math.min(100, this.getThreatLevel());
    let type = EnemyType.XenoMite;

    const roll = this.prng.next();

    if (threat < DIRECTOR.THREAT_LOW) {
      // Mostly Easy
      if (roll < 0.8) type = EnemyType.XenoMite;
      else type = EnemyType.WarriorDrone;
    } else if (threat < DIRECTOR.THREAT_HIGH) {
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
    let difficulty: number = DIRECTOR.DIFFICULTY_EASY;
    if (type === EnemyType.WarriorDrone || type === EnemyType.SpitterAcid) {
      difficulty = DIRECTOR.DIFFICULTY_MEDIUM;
    } else if (type === EnemyType.PraetorianGuard) {
      difficulty = DIRECTOR.DIFFICULTY_HARD;
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
      fireRate:
        arch.fireRate *
        (arch.speed > 0 ? SPEED_NORMALIZATION_CONST / arch.speed : 1),
      accuracy: arch.accuracy,
      attackRange: arch.attackRange,
      speed: arch.speed,
      difficulty,
    };

    this.onSpawn(enemy);
  }
}
