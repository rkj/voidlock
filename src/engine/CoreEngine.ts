import {
  MapDefinition,
  GameState,
  Unit,
  Enemy,
  UnitState,
  Command,
  SquadConfig,
  MissionType,
  Door,
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
import { IDirector } from "./interfaces/IDirector";
import { MissionManager } from "./managers/MissionManager";
import { DoorManager } from "./managers/DoorManager";
import { VisibilityManager } from "./managers/VisibilityManager";
import { EnemyManager } from "./managers/EnemyManager";
import { UnitManager } from "./managers/UnitManager";
import { TurretManager } from "./managers/TurretManager";
import { CommandHandler } from "./managers/CommandHandler";
import { LootManager } from "./managers/LootManager";
import { UnitSpawner } from "./managers/UnitSpawner";

export class CoreEngine {
  private prng: PRNG;
  private gameGrid: GameGrid;
  private pathfinder: Pathfinder;
  private los: LineOfSight;
  private state: GameState;
  private director: IDirector;

  private missionManager: MissionManager;
  private doorManager: DoorManager;
  private visibilityManager: VisibilityManager;
  private enemyManager: EnemyManager;
  private unitManager: UnitManager;
  private turretManager: TurretManager;
  private lootManager: LootManager;
  private commandHandler: CommandHandler;
  private unitSpawner: UnitSpawner;

  private commandLog: CommandLogEntry[] = [];
  private replayIndex: number = 0;
  private isCatchingUp: boolean = false;
  private sentMap: boolean = false;

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
    campaignNodeId?: string,
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
    this.turretManager = new TurretManager(this.los);
    this.lootManager = new LootManager();
    this.missionManager = new MissionManager(missionType, this.prng);
    this.visibilityManager = new VisibilityManager(this.los);
    this.unitSpawner = new UnitSpawner(this.prng);

    this.commandLog = initialCommandLog;
    this.replayIndex = 0;

    this.state = {
      t: 0,
      seed: seed,
      missionType: missionType,
      nodeType,
      campaignNodeId,
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
      mines: [],
      turrets: [],
      visibleCells: [],
      discoveredCells: [],
      gridState: new Uint8Array(map.width * map.height),
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
      this.lootManager,
    );

    // Mission-specific Spawns
    if (missionType === MissionType.EscortVIP) {
      const vips = this.unitSpawner.spawnVIPs(map);
      vips.forEach((vip) => {
        this.addUnit(vip);

        // Reveal VIP position
        const vx = Math.floor(vip.pos.x);
        const vy = Math.floor(vip.pos.y);
        const vipCellKey = `${vx},${vy}`;
        if (!this.state.discoveredCells.includes(vipCellKey)) {
          this.state.discoveredCells.push(vipCellKey);
          if (this.state.gridState) {
            this.state.gridState[vy * map.width + vx] |= 2;
          }
        }
      });
    }

    // Spawn units based on squadConfig
    const squadUnits = this.unitSpawner.spawnSquad(map, squadConfig);
    squadUnits.forEach((unit) => this.addUnit(unit));

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

    // Catch-up Phase: If in Simulation or Replay mode but have a target tick, fast-forward.
    // In Simulation mode, we also ensure we catch up to at least the last command tick for session recovery.
    let finalCatchupTick = targetTick;
    if (mode === EngineMode.Simulation) {
      const lastCommandTick =
        this.commandLog.length > 0
          ? this.commandLog[this.commandLog.length - 1].tick
          : 0;
      finalCatchupTick = Math.max(lastCommandTick, targetTick);
    }

    if (finalCatchupTick > 0) {
      this.isCatchingUp = true;
      while (this.state.t < finalCatchupTick) {
        // We use a fixed 16ms step for deterministic catch-up, but cap it at the target
        const step = Math.min(16, finalCatchupTick - this.state.t);
        this.update(step);
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
    const state = this.state;
    // Manual shallow copy of the state structure.
    // We avoid deep cloning elements here because postMessage() 
    // in the worker performs a structured clone anyway.
    const copy: GameState = {
      ...state,
      units: [...state.units],
      enemies: [...state.enemies],
      loot: [...state.loot],
      mines: [...state.mines],
      turrets: [...state.turrets],
      attackEvents: state.attackEvents
        ? [...state.attackEvents]
        : [],
      objectives: [...state.objectives],
      visibleCells: [...state.visibleCells],
      discoveredCells: [...state.discoveredCells],
      gridState: state.gridState ? new Uint8Array(state.gridState) : undefined,
      stats: { ...state.stats },
      settings: { ...state.settings },
      squadInventory: { ...state.squadInventory },
      map: {
        ...state.map,
        // Omit static data after first send
        cells: this.sentMap ? [] : state.map.cells,
        walls: this.sentMap ? [] : state.map.walls,
        boundaries: this.sentMap ? [] : state.map.boundaries,
        spawnPoints: this.sentMap ? [] : state.map.spawnPoints,
        objectives: this.sentMap ? [] : state.map.objectives,
        // Doors are dynamic, always send them
        doors: Array.from(this.doorManager.getDoors().values()).map((d) => ({
          ...d,
        })),
      },
    };

    if (!this.sentMap) {
      this.sentMap = true;
    }

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

  public update(scaledDt: number) {
    if (
      this.state.status !== "Playing" &&
      !this.isCatchingUp &&
      this.state.settings.mode !== EngineMode.Replay
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

    // Use a fresh reference for the tick update
    this.state = {
      ...this.state,
      t: this.state.t + scaledDt,
      attackEvents: [], // Clear events for new tick
      stats: {
        ...this.state.stats,
        threatLevel: this.director.getThreatLevel(),
      },
    };

    // 1. Director & Spawn (Uses scaledDt to follow game speed and pause)
    this.director.update(scaledDt);
    // Re-sync threat level after director update
    this.state.stats.threatLevel = this.director.getThreatLevel();

    // 2. Doors
    this.doorManager.update(this.state, scaledDt);

    // 3. Visibility
    this.visibilityManager.updateVisibility(this.state);

    // 4. Mission (Objectives Visibility)
    this.missionManager.updateObjectives(this.state);

    // 5. Units (Now uses scaledDt for all timers)
    this.unitManager.update(
      this.state,
      scaledDt,
      this.doorManager.getDoors(),
      this.prng,
      this.lootManager,
      this.director,
    );

    // 6. Enemies
    this.enemyManager.update(
      this.state,
      scaledDt,
      this.gameGrid,
      this.pathfinder,
      this.los,
      this.prng,
      this.unitManager.getCombatManager(),
    );

    // 7. Turrets
    this.turretManager.update(
      this.state,
      scaledDt,
      this.prng,
      this.unitManager.getCombatManager(),
    );

    // 8. Cleanup Death (Must be after both Unit and Enemy updates)
    let statsChanged = false;
    let newCasualties = this.state.stats.casualties;

    const nextUnits = this.state.units.map((unit) => {
      if (unit.hp <= 0 && unit.state !== UnitState.Dead) {
        statsChanged = true;
        newCasualties++;

        const updatedUnit = {
          ...unit,
          state: UnitState.Dead,
          carriedObjectiveId: undefined,
        };

        if (unit.carriedObjectiveId) {
          const objectiveId = unit.carriedObjectiveId;
          this.state.objectives = this.state.objectives.map((o) => {
            if (o.id === objectiveId) {
              const updatedObj = {
                ...o,
                state: "Pending" as const,
                targetCell: {
                  x: Math.floor(unit.pos.x),
                  y: Math.floor(unit.pos.y),
                },
              };

              if (objectiveId.startsWith("artifact")) {
                this.lootManager.spawnLoot(
                  this.state,
                  "artifact_heavy",
                  unit.pos,
                  o.id,
                );
              }
              return updatedObj;
            }
            return o;
          });
        }
        return updatedUnit;
      }
      return unit;
    });

    this.state.units = nextUnits;

    if (statsChanged) {
      this.state.stats = {
        ...this.state.stats,
        casualties: newCasualties,
      };
    }

    // 8. Win/Loss
    this.missionManager.checkWinLoss(this.state);
  }
}
