import {
  MapDefinition,
  Unit,
  UnitState,
  SquadConfig,
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
  Vector2,
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { SPEED_NORMALIZATION_CONST } from "../config/GameConstants";
import { MathUtils } from "../../shared/utils/MathUtils";

export class UnitSpawner {
  constructor(private prng: PRNG) {}

  public spawnSquad(
    map: MapDefinition,
    squadConfig: SquadConfig,
    skipDeployment: boolean = true,
  ): Unit[] {
    const units: Unit[] = [];
    let unitCount = 1;

    // Collect available spawn positions
    let availableSpawns = [...(map.squadSpawns || [])];
    if (availableSpawns.length === 0) {
      if (map.squadSpawn) {
        availableSpawns = [map.squadSpawn];
      } else if (map.extraction) {
        availableSpawns = [map.extraction];
      } else {
        availableSpawns = [{ x: 0, y: 0 }];
      }
    }

    // Shuffle spawns for variety
    if (skipDeployment) {
      for (let i = availableSpawns.length - 1; i > 0; i--) {
        const j = this.prng.nextInt(0, i);
        [availableSpawns[i], availableSpawns[j]] = [
          availableSpawns[j],
          availableSpawns[i],
        ];
      }
    }

    squadConfig.soldiers.forEach((soldierConfig, index) => {
      const arch = ArchetypeLibrary[soldierConfig.archetypeId];
      if (!arch) return;

      // Rotate through available spawns if more units than tiles
      const startPos = availableSpawns[index % availableSpawns.length];

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

      units.push({
        id: soldierConfig.id || `${arch.id}-${unitCount++}`,
        name: soldierConfig.name || arch.name,
        tacticalNumber: soldierConfig.tacticalNumber || units.length + 1,
        archetypeId: arch.id,
        pos: {
          x: startX + (this.prng.next() - 0.5) * 0.8,
          y: startY + (this.prng.next() - 0.5) * 0.8,
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
        aiEnabled: arch.id !== "vip",
        kills: 0,
        damageDealt: 0,
        objectivesCompleted: 0,
        isDeployed: skipDeployment,
      });
    });

    return units;
  }

  public spawnVIPs(map: MapDefinition): Unit[] {
    const units: Unit[] = [];
    const vipArch = ArchetypeLibrary["vip"];

    const squadPos = map.squadSpawn ||
      (map.squadSpawns && map.squadSpawns[0]) || { x: 0, y: 0 };
    const vipSpawnPositions = this.findVipStartPositions(map, squadPos, 1);

    vipSpawnPositions.forEach((startPos, idx) => {
      units.push({
        id: `vip-${idx + 1}`,
        name: vipArch.name,
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
            vipArch.fireRate *
            (vipArch.speed > 0 ? SPEED_NORMALIZATION_CONST / vipArch.speed : 1),
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
        isDeployed: true,
      });
    });

    return units;
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
        candidateRooms.push({
          roomId,
          dist: MathUtils.getDistance(center, squadPos),
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
}
