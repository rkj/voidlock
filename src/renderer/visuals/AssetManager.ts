import { Icons } from "@src/renderer/Icons";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { Logger } from "@src/shared/Logger";

export class AssetManager {
  private static instance: AssetManager;
  public iconImages: Record<string, HTMLImageElement> = {};
  public unitSprites: Record<string, HTMLImageElement> = {};
  public enemySprites: Record<string, HTMLImageElement> = {};
  private theme = ThemeManager.getInstance();

  private readonly UNIT_SPRITE_MAP: Record<string, string> = {
    assault: "soldier_demolition",
    heavy: "soldier_heavy",
    medic: "soldier_medic",
    scout: "soldier_scout",
    vip: "soldier_scout",
  };

  private readonly ENEMY_SPRITE_MAP: Record<string, string> = {
    "xeno-mite": "xeno_swarmer_1",
    "warrior-drone": "xeno_drone_2",
    "praetorian-guard": "xeno_guard_3",
    "spitter-acid": "xeno_spitter",
    hive: "void",
  };

  private readonly MISC_SPRITE_MAP: Record<string, string> = {
    spawn: "spawn_point",
    waypoint: "waypoint",
  };

  private constructor() {
    this.loadIcons();
    this.loadSprites();
  }

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  private loadIcons() {
    Object.entries(Icons).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      this.iconImages[key] = img;
    });
  }

  public loadSprites() {
    // Ensure ThemeManager is ready and has the required method (resilience for tests)
    if (typeof (this.theme as any).getAssetUrl !== "function") {
      Logger.warn(
        "AssetManager: ThemeManager.getAssetUrl is not a function. Manifest not loaded yet or mocked?",
      );
      return;
    }

    // Load Unit Sprites
    Object.values(this.UNIT_SPRITE_MAP).forEach((logicalName) => {
      if (this.unitSprites[logicalName]) return;
      const url = this.theme.getAssetUrl(logicalName);
      if (url) {
        const img = new Image();
        img.src = url;
        this.unitSprites[logicalName] = img;
      }
    });

    // Load Enemy Sprites
    Object.values(this.ENEMY_SPRITE_MAP).forEach((logicalName) => {
      if (this.enemySprites[logicalName]) return;
      const url = this.theme.getAssetUrl(logicalName);
      if (url) {
        const img = new Image();
        img.src = url;
        this.enemySprites[logicalName] = img;
      }
    });

    // Load Misc Sprites
    Object.values(this.MISC_SPRITE_MAP).forEach((logicalName) => {
      if (this.unitSprites[logicalName]) return;
      const url = this.theme.getAssetUrl(logicalName);
      if (url) {
        const img = new Image();
        img.src = url;
        this.unitSprites[logicalName] = img;
      }
    });
  }

  public getUnitSprite(archetypeId: string): HTMLImageElement | null {
    const logicalName = this.UNIT_SPRITE_MAP[archetypeId];
    return logicalName ? this.unitSprites[logicalName] : null;
  }

  public getEnemySprite(type: string): HTMLImageElement | null {
    const logicalName = this.ENEMY_SPRITE_MAP[type];
    return logicalName ? this.enemySprites[logicalName] : null;
  }

  public getMiscSprite(key: string): HTMLImageElement | null {
    const logicalName = this.MISC_SPRITE_MAP[key];
    return logicalName ? this.unitSprites[logicalName] : null;
  }

  public getIcon(key: string): HTMLImageElement | null {
    return this.iconImages[key] || null;
  }
}
