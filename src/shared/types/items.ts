import { Vector2 } from "./geometry";

export type Mine = {
  id: string;
  pos: Vector2;
  damage: number;
  radius: number;
  ownerId: string;
};

export type LootItem = {
  id: string;
  itemId: string;
  pos: Vector2;
  objectiveId?: string;
};

// --- Item & Equipment Definitions ---

export type ItemType = "Passive" | "Active";

export type Item = {
  id: string;
  name: string;
  type: ItemType;
  description?: string;
  // Passive effects
  hpBonus?: number;
  speedBonus?: number;
  accuracyBonus?: number;
  // Active effects
  action?: "Heal" | "Grenade" | "Mine" | "Scanner";
  charges?: number;
  channelTime?: number; // time in ms to use the item
  healAmount?: number; // amount of HP to recover
  cost: number;
};

export type EquipmentState = {
  body?: string;
  feet?: string;
  rightHand?: string;
  leftHand?: string;
};

export const ItemLibrary: { [id: string]: Item } = {
  frag_grenade: {
    id: "frag_grenade",
    name: "Frag Grenade",
    type: "Active",
    description: "Anti-personnel explosive with a moderate blast radius.",
    action: "Grenade",
    charges: 2,
    cost: 15,
  },
  medkit: {
    id: "medkit",
    name: "Medkit",
    type: "Active",
    description: "Portable medical supplies to treat injuries in the field.",
    action: "Heal",
    charges: 1,
    channelTime: 2000,
    healAmount: 50,
    cost: 10,
  },
  stimpack: {
    id: "stimpack",
    name: "Stimpack",
    type: "Active",
    description:
      "A single-use chemical stimulant that provides instant minor healing.",
    action: "Heal",
    charges: 1,
    healAmount: 25,
    cost: 5,
  },
  mine: {
    id: "mine",
    name: "Landmine",
    type: "Active",
    description: "Proximity-detonated explosive. Good for covering retreats.",
    action: "Mine",
    charges: 2,
    channelTime: 3000,
    cost: 15,
  },
  scanner: {
    id: "scanner",
    name: "Scanner",
    type: "Active",
    description: "Reveals enemies and objectives through fog of war.",
    action: "Scanner",
    charges: 3,
    cost: 20,
  },
  combat_boots: {
    id: "combat_boots",
    name: "Combat Boots",
    type: "Passive",
    description: "Standard issue tactical footwear.",
    speedBonus: 5, // +0.5 tiles/s
    cost: 0,
  },
  mag_lev_boots: {
    id: "mag_lev_boots",
    name: "Mag-Lev Boots",
    type: "Passive",
    description:
      "Advanced boots that reduce friction, significantly increasing movement speed.",
    speedBonus: 10, // +1.0 tiles/s
    cost: 30,
  },
  light_recon: {
    id: "light_recon",
    name: "Light Recon Armor",
    type: "Passive",
    description:
      "Lightweight plating that provides protection without sacrificing mobility.",
    hpBonus: 50,
    speedBonus: 2,
    cost: 20,
  },
  heavy_plate: {
    id: "heavy_plate",
    name: "Heavy Plate Armor",
    type: "Passive",
    description:
      "Thick ceramic plating. Provides massive HP but slows the user and slightly impairs aim.",
    hpBonus: 150,
    speedBonus: -5,
    accuracyBonus: -10,
    cost: 50,
  },
  artifact_heavy: {
    id: "artifact_heavy",
    name: "Heavy Artifact",
    type: "Passive",
    description:
      "A heavy alien artifact. Its weight and strange energy fields significantly slow the carrier and impair their aim.",
    speedBonus: -10,
    accuracyBonus: -15,
    cost: 0,
  },
  scrap_crate: {
    id: "scrap_crate",
    name: "Scrap Crate",
    type: "Passive",
    description: "A crate filled with valuable scrap metal and components.",
    cost: 0,
  },
};

export type WeaponType = "Melee" | "Ranged";

export type Weapon = {
  id: string;
  name: string;
  type: WeaponType;
  description?: string;
  damage: number;
  fireRate: number; // ms
  accuracy: number; // Percentage modifier relative to soldierAim
  range: number;
  cost: number;
};

export const WeaponLibrary: { [id: string]: Weapon } = {
  combat_knife: {
    id: "combat_knife",
    name: "Combat Knife",
    type: "Melee",
    description: "A reliable blade for close-quarters combat.",
    damage: 15,
    fireRate: 400,
    accuracy: 10,
    range: 1,
    cost: 0,
  },
  power_sword: {
    id: "power_sword",
    name: "Power Sword",
    type: "Melee",
    description: "Energized blade that shears through armor with ease.",
    damage: 35,
    fireRate: 800,
    accuracy: 15,
    range: 1,
    cost: 25,
  },
  thunder_hammer: {
    id: "thunder_hammer",
    name: "Thunder Hammer",
    type: "Melee",
    description: "A massive hammer that releases a kinetic blast upon impact.",
    damage: 80,
    fireRate: 1500,
    accuracy: 5,
    range: 1,
    cost: 40,
  },
  pistol: {
    id: "pistol",
    name: "Pistol",
    type: "Ranged",
    description: "Standard semi-automatic sidearm.",
    damage: 15,
    fireRate: 500,
    accuracy: 0,
    range: 6,
    cost: 10,
  },
  pulse_rifle: {
    id: "pulse_rifle",
    name: "Pulse Rifle",
    type: "Ranged",
    description: "Versatile assault rifle with good range and rate of fire.",
    damage: 20,
    fireRate: 600,
    accuracy: 5,
    range: 10,
    cost: 20,
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    type: "Ranged",
    description: "Devastating at short range, but quickly loses effectiveness.",
    damage: 40,
    fireRate: 1000,
    accuracy: -10,
    range: 4,
    cost: 25,
  },
  flamer: {
    id: "flamer",
    name: "Flamer",
    type: "Ranged",
    description:
      "Projects a stream of liquid fire. Inaccurate but fast firing.",
    damage: 25,
    fireRate: 100,
    accuracy: -5,
    range: 3,
    cost: 35,
  },
};
