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
} from "@src/shared/types";
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
  private snapshots: GameState[] = [];
  private lastSnapshotTick: number = -1;

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
    nodeType: "Combat" | "Elite" | "Boss" | "Event" | "Shop" = "Combat",
    campaignNodeId?: string,
    startingPoints?: number,
    skipDeployment: boolean = true,
    debugSnapshots: boolean = false,
    debugSnapshotInterval: number = 0,
    initialSnapshots: GameState[] = [],
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
      status: skipDeployment ? "Playing" : "Deployment",
      settings: {
        mode: mode,
        debugOverlayEnabled: debugOverlayEnabled,
        debugSnapshots: debugSnapshots,
        debugSnapshotInterval: debugSnapshotInterval,
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
    const effectiveStartingPoints =
      startingPoints ??
      (missionDepth > 0
        ? baseEnemyCount + missionDepth * enemyGrowthPerMission
        : 0);

    this.director = new Director(
      spawnPoints,
      this.prng,
      (enemy) => this.enemyManager.addEnemy(this.state, enemy),
      startingThreatLevel,
      map,
      effectiveStartingPoints,
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
    const squadUnits = this.unitSpawner.spawnSquad(
      map,
      squadConfig,
      skipDeployment,
    );
    squadUnits.forEach((unit) => this.addUnit(unit));

    // Reveal spawn area and update initial visibility
    if (map.squadSpawns) {
      map.squadSpawns.forEach((sp) => {
        const vx = Math.floor(sp.x);
        const vy = Math.floor(sp.y);
        const key = `${vx},${vy}`;
        if (!this.state.discoveredCells.includes(key)) {
          this.state.discoveredCells.push(key);
          if (this.state.gridState) {
            this.state.gridState[vy * map.width + vx] |= 2;
          }
        }
      });
    } else if (map.squadSpawn) {
      const vx = Math.floor(map.squadSpawn.x);
      const vy = Math.floor(map.squadSpawn.y);
      const key = `${vx},${vy}`;
      if (!this.state.discoveredCells.includes(key)) {
        this.state.discoveredCells.push(key);
        if (this.state.gridState) {
          this.state.gridState[vy * map.width + vx] |= 2;
        }
      }
    }

    this.visibilityManager.updateVisibility(this.state);

    if (
      skipDeployment &&
      mode !== EngineMode.Replay &&
      this.commandLog.length === 0
    ) {
      // Auto-assign exploration if enabled (default behavior when skipping deployment)
      const explorationUnitIds = this.state.units
        .filter((u) => u.archetypeId !== "vip" && u.aiEnabled !== false)
        .map((u) => u.id);

      if (explorationUnitIds.length > 0) {
        this.applyCommand({
          type: CommandType.EXPLORE,
          unitIds: explorationUnitIds,
        });
      }
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
      // Optimization: Jump to nearest snapshot if available
      if (initialSnapshots && initialSnapshots.length > 0) {
        const bestSnapshot = initialSnapshots
          .filter((s) => s.t <= finalCatchupTick)
          .reduce(
            (prev, curr) => (curr.t > prev.t ? curr : prev),
            initialSnapshots[0],
          );

        if (
          bestSnapshot &&
          bestSnapshot.t > 0 &&
          bestSnapshot.t <= finalCatchupTick
        ) {
          this.hydrateFromSnapshot(bestSnapshot);
        }
      }

      this.isCatchingUp = true;
      while (this.state.t < finalCatchupTick) {
        // We use a fixed 16ms step for deterministic catch-up, but cap it at the target
        const step = Math.min(16, finalCatchupTick - this.state.t);
        this.update(step);
      }
      this.isCatchingUp = false;
    }
  }

  private hydrateFromSnapshot(snapshot: GameState) {
    this.state = {
      ...snapshot,
      units: snapshot.units.map((u) => ({ ...u })),
      enemies: snapshot.enemies.map((e) => ({ ...e })),
      loot: snapshot.loot.map((l) => ({ ...l })),
      mines: snapshot.mines.map((m) => ({ ...m })),
      turrets: snapshot.turrets.map((t) => ({ ...t })),
      objectives: snapshot.objectives.map((o) => ({ ...o })),
      visibleCells: [...snapshot.visibleCells],
      discoveredCells: [...snapshot.discoveredCells],
      gridState: snapshot.gridState
        ? new Uint8Array(snapshot.gridState)
        : undefined,
    };

    if (snapshot.rngState !== undefined) {
      this.prng.setSeed(snapshot.rngState);
    }
    if (snapshot.directorState) {
      this.director.setState(snapshot.directorState);
    }

    // Re-initialize dynamic managers with snapshot state
    if (snapshot.map.doors) {
      this.doorManager = new DoorManager(snapshot.map.doors, this.gameGrid);
    }

    // Advance replayIndex to the correct position for the snapshot time
    this.replayIndex = 0;
    while (
      this.replayIndex < this.commandLog.length &&
      this.commandLog[this.replayIndex].tick <= this.state.t
    ) {
      this.replayIndex++;
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

  public handleUseItem(state: GameState, cmd: any): void {
    this.director.handleUseItem(state, cmd);
  }

  public getThreatLevel(): number {
    return this.director.getThreatLevel();
  }

  public preSpawn(): void {
    this.director.preSpawn();
  }

  public getState(
    pruneForObservation: boolean = false,
    includeSnapshots: boolean = false,
  ): GameState {
    const state = this.state;

    const debugMode = state.settings.debugOverlayEnabled;
    const shouldPrune = pruneForObservation && !debugMode;

    // Prune entities based on visibility if shouldPrune is true
    const enemies = !shouldPrune
      ? [...state.enemies]
      : state.enemies.filter((e) => {
          const ex = Math.floor(e.pos.x);
          const ey = Math.floor(e.pos.y);
          const idx = ey * state.map.width + ex;
          return state.gridState && (state.gridState[idx] & 1) !== 0;
        });

    const turrets = !shouldPrune
      ? [...state.turrets]
      : state.turrets.filter((t) => {
          const tx = Math.floor(t.pos.x);
          const ty = Math.floor(t.pos.y);
          const idx = ty * state.map.width + tx;
          return state.gridState && (state.gridState[idx] & 1) !== 0;
        });

    const mines = !shouldPrune
      ? [...state.mines]
      : state.mines.filter((m) => {
          const mx = Math.floor(m.pos.x);
          const my = Math.floor(m.pos.y);
          const idx = my * state.map.width + mx;
          return state.gridState && (state.gridState[idx] & 1) !== 0;
        });

    const loot = !shouldPrune
      ? [...state.loot]
      : state.loot.filter((l) => {
          const lx = Math.floor(l.pos.x);
          const ly = Math.floor(l.pos.y);
          const idx = ly * state.map.width + lx;
          // Loot is visible if cell is discovered (bit 1) or currently visible (bit 0)
          return state.gridState && (state.gridState[idx] & 3) !== 0;
        });

    // Manual shallow copy of the state structure.
    // We avoid deep cloning elements here because postMessage()
    // in the worker performs a structured clone anyway.
    const copy: GameState = {
      ...state,
      units: [...state.units],
      enemies,
      loot,
      mines,
      turrets,
      attackEvents: state.attackEvents ? [...state.attackEvents] : [],
      objectives: [...state.objectives],
      visibleCells: [...state.visibleCells],
      discoveredCells: [...state.discoveredCells],
      gridState: state.gridState ? new Uint8Array(state.gridState) : undefined,
      rngState: this.prng.getSeed(),
      directorState: this.director.getState(),
      stats: { ...state.stats },
      settings: { ...state.settings },
      squadInventory: { ...state.squadInventory },
      map: {
        ...state.map,
        // Omit large static data after first send
        cells: this.sentMap ? [] : state.map.cells,
        walls: this.sentMap ? [] : state.map.walls,
        boundaries: this.sentMap ? [] : state.map.boundaries,
        // Always include critical mission entities (ADR 0032)
        spawnPoints: state.map.spawnPoints || [],
        extraction: state.map.extraction,
        squadSpawns:
          state.map.squadSpawns ||
          (state.map.squadSpawn ? [state.map.squadSpawn] : []),
        objectives: state.map.objectives || [],
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

    if (includeSnapshots && this.state.settings.debugSnapshots) {
      copy.snapshots = [...this.snapshots];
    }

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

  private accumulator: number = 0;
  private readonly SIM_TICK_MS: number = 16;

  public update(scaledDt: number) {
    if (
      this.state.status !== "Playing" &&
      !this.isCatchingUp &&
      this.state.settings.mode !== EngineMode.Replay
    )
      return;

    if (scaledDt === 0 && !this.isCatchingUp) return;

    // Use an accumulator to ensure fixed simulation steps for determinism.
    // This ensures that update(32) is identical to update(16) twice.
    this.accumulator += scaledDt;

    while (this.accumulator >= this.SIM_TICK_MS) {
      this.simulationStep(this.SIM_TICK_MS);
      this.accumulator -= this.SIM_TICK_MS;
    }
  }

  private simulationStep(dt: number) {
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
      t: this.state.t + dt,
      attackEvents: [], // Clear events for new tick
      stats: {
        ...this.state.stats,
        threatLevel: this.director.getThreatLevel(),
      },
    };

    // 1. Director & Spawn (Uses dt to follow game speed and pause)
    this.director.update(dt);
    // Re-sync threat level after director update
    this.state.stats.threatLevel = this.director.getThreatLevel();

    // 2. Doors
    this.doorManager.update(this.state, dt);

    // 3. Visibility
    this.visibilityManager.updateVisibility(this.state);

    // 4. Mission (Objectives Visibility)
    this.missionManager.updateObjectives(this.state);

    // 5. Units (Now uses dt for all timers)
    this.unitManager.update(
      this.state,
      dt,
      this.doorManager.getDoors(),
      this.prng,
      this.lootManager,
      this.director,
    );

    // 6. Enemies
    this.enemyManager.update(
      this.state,
      dt,
      this.gameGrid,
      this.pathfinder,
      this.los,
      this.prng,
      this.unitManager.getCombatManager(),
    );

    // 7. Turrets
    this.turretManager.update(
      this.state,
      dt,
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

    // 9. Debug Snapshots
    const interval = this.state.settings.debugSnapshotInterval || 0;
    const shouldSnapshot =
      (this.state.settings.debugSnapshots || interval > 0) &&
      !this.isCatchingUp;

    if (shouldSnapshot) {
      const snapshotIntervalMs = interval > 0 ? interval * 16 : 1600; // Default to 100 ticks if only boolean is set
      if (
        this.lastSnapshotTick === -1 ||
        this.state.t >= this.lastSnapshotTick + snapshotIntervalMs
      ) {
        this.snapshots.push(this.getState(false, false));
        this.lastSnapshotTick = this.state.t;
      }
    }
  }
}
