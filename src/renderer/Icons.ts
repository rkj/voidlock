// Tactical Icons for Voidlock
// Now pointing to external SVG files in public/assets/icons/

const base = import.meta.env.BASE_URL;

export const Icons = {
  Exit: base + "assets/icons/exit.svg",
  Spawn: base + "assets/icons/spawn.svg",
  Objective: base + "assets/icons/objective.svg",
  Hive: base + "assets/icons/hive.svg",
  Speed: base + "assets/icons/speed.svg",
  Accuracy: base + "assets/icons/accuracy.svg",
  Damage: base + "assets/icons/damage.svg",
  Rate: base + "assets/icons/rate.svg",
  Range: base + "assets/icons/range.svg",
  Health: base + "assets/icons/health.svg",
  Visibility: base + "assets/icons/visibility.svg",
  Crate: base + "assets/crate.webp",
  Loot: base + "assets/loot_credits.webp",
  LootStar: base + "assets/icons/loot_star.svg",
  ObjectiveDisk: base + "assets/data_disk.webp",
};
