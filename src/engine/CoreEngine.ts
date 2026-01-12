import {
  MapDefinition,
  BoundaryDefinition,
  GameState,
  Unit,
  Enemy,
  UnitState,
  Command,
  SquadConfig,
  MissionType,
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
  EquipmentState,
  Door,
  Vector2,
  EngineMode,
  CommandLogEntry,
  CommandType,
  CampaignNodeType,
} from "../shared/types";
import { PRNG } from "../shared/PRNG";
import { GameGrid } from "./GameGrid";
import { Pathfinder } from "./Pathfinder";
import { LineOfSight } from "./LineOfSight";
import { Director } from "./Director";
import { MissionManager } from "./managers/MissionManager";
import { DoorManager } from "./managers/DoorManager";
import { VisibilityManager } from "./managers/VisibilityManager";
import { EnemyManager } from "./managers/EnemyManager";
import { UnitManager } from "./managers/UnitManager";
import { CommandHandler } from "./managers/CommandHandler";
import { LootManager } from "./managers/LootManager";
import { SPEED_NORMALIZATION_CONST } from "./Constants";

export class CoreEngine {
  private prng: PRNG;
  private gameGrid: GameGrid;
  private pathfinder: Pathfinder;
  private los: LineOfSight;
  private state: GameState;
  private director: Director;

  private missionManager: MissionManager;
  private doorManager: DoorManager;
  private visibilityManager: VisibilityManager;
  private enemyManager: EnemyManager;
  private unitManager: UnitManager;
  private lootManager: LootManager;
  private commandHandler: CommandHandler;

  private commandLog: CommandLogEntry[] = [];
  private replayIndex: number = 0;
  private isCatchingUp: boolean = false;

  // For test compatibility
  public get doors(): Map<string, Door> {
    return this.doorManager.getDoors();
  }

  constructor(
    map: MapDefinition,
    seed: number,
    squadConfig: SquadConfig,
    agentControlEnabled: boolean,
    debugOverlayEnabled: boolean,
    missionType: MissionType = MissionType.Default,
    losOverlayEnabled: boolean = false,
    startingThreatLevel: number = 0,
    initialTimeScale: number = 1.0,
    startPaused: boolean = false,
    mode: EngineMode = EngineMode.Simulation,
    initialCommandLog: CommandLogEntry[] = [],
    allowTacticalPause: boolean = true,
    targetTick: number = 0,
    baseEnemyCount: number = 3,
    enemyGrowthPerMission: number = 1,
    missionDepth: number = 0,
    nodeType?: CampaignNodeType,
  ) {
    this.prng = new PRNG(seed);
    this.gameGrid = new GameGrid(map);
    this.doorManager = new DoorManager(map.doors || [], this.gameGrid);
    this.pathfinder = new Pathfinder(
      this.gameGrid.getGraph(),
      this.doorManager.getDoors(),
    );
    this.los = new LineOfSight(
      this.gameGrid.getGraph(),
      this.doorManager.getDoors(),
    );

    this.enemyManager = new EnemyManager();
    this.unitManager = new UnitManager(
      this.gameGrid,
      this.pathfinder,
      this.los,
      agentControlEnabled,
    );
    this.lootManager = new LootManager();
    this.missionManager = new MissionManager(missionType, this.prng);
    this.visibilityManager = new VisibilityManager(this.los);

    this.commandLog = initialCommandLog;
    this.replayIndex = 0;

    this.state = {
      t: 0,
      seed: seed,
      missionType: missionType,
      nodeType: nodeType, // Add nodeType to state if needed, let's check GameState first
      map: {
        ...map,
        boundaries:
          map.boundaries ||
          this.gameGrid
            .getGraph()
            .getAllBoundaries()
            .map((b) => ({
              x1: b.x1,
              y1: b.y1,
              x2: b.x2,
              y2: b.y2,
              type: b.type,
              doorId: b.doorId,
            })),
      },
      units: [],
      enemies: [],
      loot: [],
      visibleCells: [],
      discoveredCells: [],
      objectives: [],
      stats: {
        threatLevel: startingThreatLevel,
        aliensKilled: 0,
        elitesKilled: 0,
        scrapGained: 0,
        casualties: 0,
      },
      status: "Playing",
      settings: {
        mode: mode,
        debugOverlayEnabled: debugOverlayEnabled,
        losOverlayEnabled: losOverlayEnabled,
        timeScale: initialTimeScale,
        isPaused: startPaused,
        isSlowMotion: initialTimeScale < 1.0,
        allowTacticalPause: allowTacticalPause,
      },
      squadInventory: squadConfig.inventory || {},
    };

    // Initialize Director
    const spawnPoints = map.spawnPoints || [];
    this.director = new Director(
      spawnPoints,
      this.prng,
      (enemy) => this.enemyManager.addEnemy(this.state, enemy),
      startingThreatLevel,
      baseEnemyCount,
      enemyGrowthPerMission,
      missionDepth,
    );
    this.director.preSpawn();

    this.commandHandler = new CommandHandler(this.unitManager, this.director);

    // Mission Setup
    this.missionManager.setupMission(
      this.state,
      map,
      this.enemyManager,
      squadConfig,
      nodeType,
    );

    // Mission-specific Spawns
    if (missionType === MissionType.EscortVIP) {
      const vipArch = ArchetypeLibrary["vip"];

      const squadPos = map.squadSpawn ||
        (map.squadSpawns && map.squadSpawns[0]) || { x: 0, y: 0 };
      const vipSpawnPositions = this.findVipStartPositions(map, squadPos, 1);

      vipSpawnPositions.forEach((startPos, idx) => {
        this.addUnit({
          id: `vip-${idx + 1}`,
          archetypeId: "vip",
          pos: {
            x: startPos.x + 0.5 + (this.prng.next() - 0.5) * 0.2,
            y: startPos.y + 0.5 + (this.prng.next() - 0.5) * 0.2,
          },
          visualJitter: {
            x: (this.prng.next() - 0.5) * 0.4,
            y: (this.prng.next() - 0.5) * 0.4,
          },
          hp: Math.floor(vipArch.baseHp * 0.5),
          maxHp: vipArch.baseHp,
          state: UnitState.Idle,
          stats: {
            damage: vipArch.damage,
            fireRate:
              vipArch.fireRate * (vipArch.speed > 0 ? SPEED_NORMALIZATION_CONST / vipArch.speed : 1),
            soldierAim: vipArch.soldierAim,
            equipmentAccuracyBonus: 0,
            accuracy: vipArch.soldierAim,
            attackRange: vipArch.attackRange,
            speed: vipArch.speed,
          },
          aiProfile: vipArch.aiProfile,
          aiEnabled: false,
          commandQueue: [],
          kills: 0,
          damageDealt: 0,
          objectivesCompleted: 0,
        } as Unit);

        // Reveal VIP position
        const vipCellKey = `${Math.floor(startPos.x)},${Math.floor(startPos.y)}`;
        if (!this.state.discoveredCells.includes(vipCellKey)) {
          this.state.discoveredCells.push(vipCellKey);
        }
      });
    }

    // Spawn units based on squadConfig
    let unitCount = 1;
    squadConfig.soldiers.forEach((soldierConfig) => {
      const arch = ArchetypeLibrary[soldierConfig.archetypeId];
      if (!arch) return;

      let startPos = map.squadSpawn || map.extraction || { x: 0, y: 0 };
      if (map.squadSpawns && map.squadSpawns.length > 0) {
        startPos =
          map.squadSpawns[this.prng.nextInt(0, map.squadSpawns.length - 1)];
      }

      const startX = startPos.x + 0.5;
      const startY = startPos.y + 0.5;

      let hp = soldierConfig.hp ?? arch.baseHp;
      let maxHp = soldierConfig.maxHp ?? soldierConfig.hp ?? arch.baseHp;
      const soldierAim = soldierConfig.soldierAim ?? arch.soldierAim;
      let speed = arch.speed;
      let equipmentAccuracyBonus = 0;

      const rightHand = soldierConfig.rightHand || arch.rightHand;
      const leftHand = soldierConfig.leftHand || arch.leftHand;
      const body = soldierConfig.body || arch.body;
      const feet = soldierConfig.feet || arch.feet;

      const slots = [body, feet, rightHand, leftHand];
      slots.forEach((itemId) => {
        if (itemId) {
          const item = ItemLibrary[itemId];
          if (item) {
            hp += item.hpBonus || 0;
            maxHp += item.hpBonus || 0;
            speed += item.speedBonus || 0;
            equipmentAccuracyBonus += item.accuracyBonus || 0;
          }
        }
      });

      const activeWeaponId = rightHand || "";
      const activeWeapon = WeaponLibrary[activeWeaponId];
      const weaponAccuracy = activeWeapon ? activeWeapon.accuracy : 0;

      this.addUnit({
        id: soldierConfig.id || `${arch.id}-${unitCount++}`,
        archetypeId: arch.id,
        pos: {
          x: startX + (this.prng.next() - 0.5),
          y: startY + (this.prng.next() - 0.5),
        },
        visualJitter: {
          x: (this.prng.next() - 0.5) * 0.4,
          y: (this.prng.next() - 0.5) * 0.4,
        },
        hp: hp,
        maxHp: maxHp,
        state: UnitState.Idle,
        stats: {
          damage: activeWeapon ? activeWeapon.damage : arch.damage,
          fireRate: activeWeapon ? activeWeapon.fireRate : arch.fireRate,
          soldierAim: soldierAim,
          equipmentAccuracyBonus,
          accuracy: soldierAim + equipmentAccuracyBonus + weaponAccuracy,
          attackRange: activeWeapon ? activeWeapon.range : arch.attackRange,
          speed: speed,
        },
        rightHand,
        leftHand,
        body,
        feet,
        activeWeaponId,
        aiProfile: arch.aiProfile,
        engagementPolicy: "ENGAGE",
        engagementPolicySource: "Manual",
        commandQueue: [],
        aiEnabled: false,
        kills: 0,
        damageDealt: 0,
        objectivesCompleted: 0,
      } as Unit);
    });

    // Default EXPLORE command for all non-VIP units
    const explorationUnitIds = this.state.units
      .filter((u) => u.archetypeId !== "vip")
      .map((u) => u.id);

    if (explorationUnitIds.length > 0 && this.commandLog.length === 0) {
      this.applyCommand({
        type: CommandType.EXPLORE,
        unitIds: explorationUnitIds,
      });
    }

    // Catch-up Phase: If in Simulation mode but have a command log or target tick, fast-forward
    const lastCommandTick = this.commandLog.length > 0 
      ? this.commandLog[this.commandLog.length - 1].tick 
      : 0;
    const finalCatchupTick = Math.max(lastCommandTick, targetTick);

    if (mode === EngineMode.Simulation && finalCatchupTick > 0) {
      this.isCatchingUp = true;
      while (this.state.t < finalCatchupTick) {
        // We use a fixed 16ms step for deterministic catch-up
        this.update(16, 16);
      }
      this.isCatchingUp = false;
    }
  }

  public clearUnits() {
    this.state.units = [];
  }

  public addUnit(unit: Unit) {
    this.state.units.push(unit);
  }

  public addEnemy(enemy: Enemy) {
    this.enemyManager.addEnemy(this.state, enemy);
  }

  public getState(): GameState {
    const copy = JSON.parse(JSON.stringify(this.state));
    copy.commandLog = [...this.commandLog];
    return copy;
  }

  public applyCommand(cmd: Command) {
    if (this.state.settings.mode === EngineMode.Simulation) {
      if (!this.isCatchingUp) {
        this.commandLog.push({ tick: this.state.t, command: cmd });
      }
      this.commandHandler.applyCommand(this.state, cmd);
    }
  }

  public setTimeScale(scale: number) {
    let effectiveScale = scale;
    if (!this.state.settings.allowTacticalPause && scale < 1.0 && scale > 0) {
      effectiveScale = 1.0;
    }
    this.state.settings.timeScale = effectiveScale;
    this.state.settings.isSlowMotion = effectiveScale < 1.0;
  }

  public setPaused(paused: boolean) {
    this.state.settings.isPaused = paused;
  }

  private findVipStartPositions(
    map: MapDefinition,
    squadPos: Vector2,
    count: number,
  ): Vector2[] {
    const rooms = new Map<string, Vector2[]>();
    map.cells.forEach((cell) => {
      if (
        cell.type === "Floor" &&
        cell.roomId &&
        cell.roomId.startsWith("room-")
      ) {
        if (!rooms.has(cell.roomId)) rooms.set(cell.roomId, []);
        rooms.get(cell.roomId)!.push({ x: cell.x, y: cell.y });
      }
    });

    if (rooms.size === 0) return [map.extraction || { x: 0, y: 0 }];

    const squadQX = squadPos.x < map.width / 2 ? 0 : 1;
    const squadQY = squadPos.y < map.height / 2 ? 0 : 1;

    const candidateRooms: {
      roomId: string;
      dist: number;
      qx: number;
      qy: number;
    }[] = [];

    rooms.forEach((cells, roomId) => {
      const center = {
        x: cells.reduce((sum, c) => sum + c.x, 0) / cells.length,
        y: cells.reduce((sum, c) => sum + c.y, 0) / cells.length,
      };

      const qx = center.x < map.width / 2 ? 0 : 1;
      const qy = center.y < map.height / 2 ? 0 : 1;

      // Prefer rooms in different quadrants
      if (qx !== squadQX || qy !== squadQY) {
        const dx = center.x - squadPos.x;
        const dy = center.y - squadPos.y;
        candidateRooms.push({
          roomId,
          dist: Math.sqrt(dx * dx + dy * dy),
          qx,
          qy,
        });
      }
    });

    // Sort by distance descending (farthest first)
    candidateRooms.sort((a, b) => b.dist - a.dist);

    if (candidateRooms.length === 0) {
      // Fallback: any room except the one with squad spawn
      const squadRoomId = map.cells.find(
        (c) => c.x === Math.floor(squadPos.x) && c.y === Math.floor(squadPos.y),
      )?.roomId;
      const otherRooms = Array.from(rooms.keys()).filter(
        (id) => id !== squadRoomId,
      );
      if (otherRooms.length > 0) {
        return otherRooms.slice(0, count).map((id) => {
          const cells = rooms.get(id)!;
          return cells[this.prng.nextInt(0, cells.length - 1)];
        });
      }
      return [map.extraction || { x: 0, y: 0 }];
    }

    const selectedRooms = candidateRooms.slice(0, count);
    return selectedRooms.map((r) => {
      const cells = rooms.get(r.roomId)!;
      return cells[this.prng.nextInt(0, cells.length - 1)];
    });
  }

  public update(scaledDt: number, realDt: number = scaledDt) {
    if (
      this.state.status !== "Playing" &&
      this.state.settings.mode !== EngineMode.Replay &&
      !this.isCatchingUp
    )
      return;

    if (scaledDt === 0 && !this.isCatchingUp) return;

    // Command Playback in Replay Mode or Catch-up Phase
    if (this.state.settings.mode === EngineMode.Replay || this.isCatchingUp) {
      while (
        this.replayIndex < this.commandLog.length &&
        this.commandLog[this.replayIndex].tick <= this.state.t
      ) {
        this.commandHandler.applyCommand(
          this.state,
          this.commandLog[this.replayIndex].command,
        );
        this.replayIndex++;
      }
    }

    this.state.t += scaledDt;

    // 1. Director & Spawn (Uses scaledDt to follow game speed and pause)
    this.director.update(scaledDt);
    this.state.stats.threatLevel = this.director.getThreatLevel();

    // 2. Doors
    this.doorManager.update(this.state, scaledDt);

    // 3. Visibility
    this.visibilityManager.updateVisibility(this.state);

    // 4. Mission (Objectives Visibility)
    this.missionManager.updateObjectives(this.state, this.state.visibleCells);

    // 5. Units (Now uses scaledDt for all timers)
    this.unitManager.update(
      this.state,
      scaledDt,
      this.doorManager.getDoors(),
      this.prng,
      this.lootManager,
      this.director,
      scaledDt,
    );

    // 6. Enemies
    this.enemyManager.update(
      this.state,
      scaledDt,
      this.gameGrid,
      this.pathfinder,
      this.los,
      this.prng,
    );

    // 7. Cleanup Death (Must be after both Unit and Enemy updates)
    this.state.units.forEach((unit) => {
      if (unit.hp <= 0 && unit.state !== UnitState.Dead) {
        unit.state = UnitState.Dead;
        this.state.stats.casualties++;

        if (unit.carriedObjectiveId) {
          const obj = this.state.objectives.find(
            (o) => o.id === unit.carriedObjectiveId,
          );
          if (obj) {
            obj.state = "Pending";
            obj.targetCell = {
              x: Math.floor(unit.pos.x),
              y: Math.floor(unit.pos.y),
            };

            if (unit.carriedObjectiveId.startsWith("artifact")) {
              this.lootManager.spawnLoot(
                this.state,
                "artifact_heavy",
                unit.pos,
                obj.id,
              );
            }
          }
          unit.carriedObjectiveId = undefined;
          this.unitManager.recalculateStats(unit);
        }
      }
    });

    // 8. Win/Loss
    this.missionManager.checkWinLoss(this.state);
  }
}
