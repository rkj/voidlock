import {
  MapDefinition,
  GameState,
  Unit,
  Enemy,
  UnitState,
  Command,
  SquadConfig,
  MissionType,
  ArchetypeLibrary,
  Door,
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
  private commandHandler: CommandHandler;

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
    this.missionManager = new MissionManager(missionType, this.prng);
    this.visibilityManager = new VisibilityManager(this.los);
    this.commandHandler = new CommandHandler(this.unitManager);

    this.state = {
      t: 0,
      map,
      units: [],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      objectives: [],
      threatLevel: 0,
      aliensKilled: 0,
      casualties: 0,
      status: "Playing",
      debugOverlayEnabled: debugOverlayEnabled,
      losOverlayEnabled: losOverlayEnabled,
    };

    // Mission Setup
    this.missionManager.setupMission(this.state, map, this.enemyManager);

    // Initialize Director
    const spawnPoints = map.spawnPoints || [];
    this.director = new Director(spawnPoints, this.prng, (enemy) =>
      this.enemyManager.addEnemy(this.state, enemy),
    );

    // Mission-specific Spawns
    if (missionType === MissionType.EscortVIP) {
      const vipArch = ArchetypeLibrary["vip"];
      let startPos = map.squadSpawn || map.extraction || { x: 0, y: 0 };
      if (map.squadSpawns && map.squadSpawns.length > 0) {
        startPos =
          map.squadSpawns[this.prng.nextInt(0, map.squadSpawns.length - 1)];
      }

      this.addUnit({
        id: `vip-1`,
        archetypeId: "vip",
        pos: {
          x: startPos.x + 0.5 + (this.prng.next() - 0.5),
          y: startPos.y + 0.5 + (this.prng.next() - 0.5),
        },
        visualJitter: {
          x: (this.prng.next() - 0.5) * 0.4,
          y: (this.prng.next() - 0.5) * 0.4,
        },
        hp: Math.floor(vipArch.baseHp * 0.5),
        maxHp: vipArch.baseHp,
        state: UnitState.Idle,
        damage: vipArch.damage,
        fireRate: vipArch.fireRate,
        attackRange: vipArch.attackRange,
        sightRange: vipArch.sightRange,
        speed: vipArch.speed,
        aiEnabled: false,
        commandQueue: [],
      });

      // Reveal VIP position
      const vipCellKey = `${Math.floor(startPos.x)},${Math.floor(startPos.y)}`;
      if (!this.state.discoveredCells.includes(vipCellKey)) {
        this.state.discoveredCells.push(vipCellKey);
      }
    }

    // Spawn units based on squadConfig
    let unitCount = 1;
    squadConfig.forEach((squadItem) => {
      const arch = ArchetypeLibrary[squadItem.archetypeId];
      if (!arch) return;

      for (let i = 0; i < squadItem.count; i++) {
        let startPos = map.squadSpawn || map.extraction || { x: 0, y: 0 };
        if (map.squadSpawns && map.squadSpawns.length > 0) {
          startPos =
            map.squadSpawns[this.prng.nextInt(0, map.squadSpawns.length - 1)];
        }

        const startX = startPos.x + 0.5;
        const startY = startPos.y + 0.5;

        this.addUnit({
          id: `${arch.id}-${unitCount++}`,
          archetypeId: arch.id,
          pos: {
            x: startX + (this.prng.next() - 0.5),
            y: startY + (this.prng.next() - 0.5),
          },
          visualJitter: {
            x: (this.prng.next() - 0.5) * 0.4,
            y: (this.prng.next() - 0.5) * 0.4,
          },
          hp: arch.baseHp,
          maxHp: arch.baseHp,
          state: UnitState.Idle,
          damage: arch.damage,
          fireRate: arch.fireRate,
          attackRange: arch.attackRange,
          sightRange: arch.sightRange,
          speed: arch.speed,
          aiEnabled: true,
          commandQueue: [],
        });
      }
    });
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
    return JSON.parse(JSON.stringify(this.state));
  }

  public applyCommand(cmd: Command) {
    this.commandHandler.applyCommand(this.state, cmd);
  }

  public update(dt: number) {
    if (this.state.status !== "Playing") return;

    this.state.t += dt;

    // 1. Director & Spawn
    this.director.update(dt);
    this.state.threatLevel = this.director.getThreatLevel();

    // 2. Doors
    this.doorManager.update(this.state, dt);

    // 3. Visibility
    this.visibilityManager.updateVisibility(this.state);

    // 4. Mission (Objectives Visibility)
    this.missionManager.updateObjectives(this.state, this.state.visibleCells);

    // 5. Units
    this.unitManager.update(this.state, dt, this.doorManager.getDoors());

    // 6. Enemies
    this.enemyManager.update(
      this.state,
      dt,
      this.gameGrid,
      this.pathfinder,
      this.los,
      this.prng,
    );

    // 7. Cleanup Death (Must be after both Unit and Enemy updates)
    this.state.units.forEach((unit) => {
      if (unit.hp <= 0 && unit.state !== UnitState.Dead) {
        unit.state = UnitState.Dead;
        this.state.casualties++;
      }
    });

    // 8. Win/Loss
    this.missionManager.checkWinLoss(this.state);
  }
}
