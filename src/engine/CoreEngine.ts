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
  ItemLibrary,
  EquipmentState,
  Door,
  Vector2,
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
    startingThreatLevel: number = 0,
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
      threatLevel: startingThreatLevel,
      aliensKilled: 0,
      casualties: 0,
      status: "Playing",
      debugOverlayEnabled: debugOverlayEnabled,
      losOverlayEnabled: losOverlayEnabled,
    };

    // Mission Setup
    this.missionManager.setupMission(
      this.state,
      map,
      this.enemyManager,
      squadConfig,
    );

    // Initialize Director
    const spawnPoints = map.spawnPoints || [];
    this.director = new Director(
      spawnPoints,
      this.prng,
      (enemy) => this.enemyManager.addEnemy(this.state, enemy),
      startingThreatLevel,
    );
    this.director.preSpawn();

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
          damage: vipArch.damage,
          fireRate:
            vipArch.fireRate * (vipArch.speed > 0 ? 10 / vipArch.speed : 1),
          accuracy: vipArch.accuracy,
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
      });
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

        let hp = arch.baseHp;
        let speed = arch.speed;
        let accuracy = arch.accuracy;
        const equipment: EquipmentState = {
          inventory: [],
        };

        if (squadItem.equipment) {
          if (squadItem.equipment.armorId) {
            const armor = ItemLibrary[squadItem.equipment.armorId];
            if (armor) {
              hp += armor.hpBonus || 0;
              speed += armor.speedBonus || 0;
              accuracy += armor.accuracyBonus || 0;
              equipment.armorId = armor.id;
            }
          }
          if (squadItem.equipment.shoesId) {
            const shoes = ItemLibrary[squadItem.equipment.shoesId];
            if (shoes) {
              hp += shoes.hpBonus || 0;
              speed += shoes.speedBonus || 0;
              accuracy += shoes.accuracyBonus || 0;
              equipment.shoesId = shoes.id;
            }
          }
          if (squadItem.equipment.itemIds) {
            squadItem.equipment.itemIds.forEach((itemId) => {
              const item = ItemLibrary[itemId];
              if (item) {
                equipment.inventory.push({
                  itemId: item.id,
                  charges: item.charges || 0,
                });
                hp += item.hpBonus || 0;
                speed += item.speedBonus || 0;
                accuracy += item.accuracyBonus || 0;
              }
            });
          }
        }

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
          hp: hp,
          maxHp: hp,
          state: UnitState.Idle,
          damage: arch.damage,
          fireRate: arch.fireRate * (speed > 0 ? 10 / speed : 1),
          accuracy: accuracy,
          attackRange: arch.attackRange,
          sightRange: arch.sightRange,
          speed: speed,
          meleeWeaponId: arch.meleeWeaponId,
          rangedWeaponId: arch.rangedWeaponId,
          activeWeaponId: arch.rangedWeaponId,
          aiEnabled: true,
          commandQueue: [],
          equipment,
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
    if (this.state.status !== "Playing") return;
    if (scaledDt === 0) return;

    this.state.t += scaledDt;

    // 1. Director & Spawn (Uses scaledDt to follow game speed and pause)
    this.director.update(scaledDt);
    this.state.threatLevel = this.director.getThreatLevel();

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
        this.state.casualties++;
      }
    });

    // 8. Win/Loss
    this.missionManager.checkWinLoss(this.state);
  }
}
