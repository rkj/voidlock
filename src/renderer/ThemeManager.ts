import { ThemeConfig } from "@src/shared/types";

export class ThemeManager {
  private static instance: ThemeManager;
  private colorCache: Map<string, string> = new Map();
  private assets: Record<string, string> = {};

  private constructor() {
    // Listen for theme changes if needed in the future
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Loads the asset manifest from /assets/assets.json
   */
  public async init(): Promise<void> {
    try {
      const response = await fetch(
        import.meta.env.BASE_URL + "assets/assets.json",
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch assets.json: ${response.statusText}`);
      }
      this.assets = await response.json();
    } catch (error) {
      console.error("ThemeManager: Failed to load assets.json", error);
    }
  }

  /**
   * Returns the absolute URL for a logical asset name.
   */
  public getAssetUrl(logicalName: string): string | null {
    const path = this.assets[logicalName];
    return path ? import.meta.env.BASE_URL + path : null;
  }

  /**
   * Resolves a CSS variable to its current hex/rgba value.
   * Useful for Canvas rendering.
   */
  public getColor(varName: string): string {
    // Basic caching to avoid repeated DOM lookups per frame
    if (this.colorCache.has(varName)) {
      return this.colorCache.get(varName)!;
    }

    if (typeof getComputedStyle === "undefined") {
      return this.getFallbackColor(varName);
    }

    const value = getComputedStyle(document.body)
      .getPropertyValue(varName)
      .trim();
    if (value) {
      this.colorCache.set(varName, value);
      return value;
    }

    return this.getFallbackColor(varName);
  }

  private getFallbackColor(varName: string): string {
    const fallbacks: Record<string, string> = {
      "--color-primary": "#0f0",
      "--color-accent": "#0af",
      "--color-danger": "#f00",
      "--color-success": "#4caf50",
      "--color-success-muted": "rgba(0, 255, 0, 0.2)",
      "--color-warning": "#ff9800",
      "--color-wall": "#00ffff",
      "--color-floor": "#0a0a0a",
      "--color-grid": "#111",
      "--color-door-closed": "#ffd700",
      "--color-door-locked": "#f00",
      "--color-door-destroyed": "#550000",
      "--color-los-soldier": "rgba(0, 255, 0, 0.4)",
      "--color-los-enemy": "rgba(255, 0, 0, 0.4)",
      "--color-fog-discovered": "rgba(0, 0, 0, 0.6)",
      "--color-fog-unexplored": "#000",
      "--color-hive": "#9900ff",
      "--color-info": "#00ffff",
      "--color-black": "#000000",
      "--color-white": "#ffffff",
      "--color-los-soldier-fade": "rgba(0, 255, 0, 0)",
      "--color-los-enemy-fade": "rgba(255, 0, 0, 0)",
      "--color-objective-bg": "rgba(255, 170, 0, 0.1)",
      "--color-spawn-bg": "rgba(255, 0, 0, 0.05)",
      "--color-extraction-bg": "rgba(0, 255, 255, 0.1)",
    };
    return fallbacks[varName] || "#000000";
  }

  /**
   * Returns the URL for a standard icon.
   */
  public getIconUrl(iconName: string): string {
    return (
      import.meta.env.BASE_URL + `assets/icons/${iconName.toLowerCase()}.svg`
    );
  }

  /**
   * Switches themes by adding/removing classes from the <body>.
   */
  public setTheme(themeName: string): void {
    document.body.className = `theme-${themeName}`;
    this.colorCache.clear(); // Clear cache as colors might have changed
  }

  /**
   * Returns the current theme ID.
   */
  public getCurrentThemeId(): string {
    return document.body.className.replace("theme-", "") || "default";
  }

  /**
   * Programmatically applies a theme configuration by overriding CSS variables.
   */
  public applyTheme(config: ThemeConfig): void {
    const root = document.body;
    Object.entries(config.colors).forEach(([name, value]) => {
      // Ensure variable names start with --
      const varName = name.startsWith("--") ? name : `--${name}`;
      root.style.setProperty(varName, value);
    });
    this.colorCache.clear();
  }
}
