import type { ThemeConfig } from "@src/shared/types";
import { Logger } from "@src/shared/Logger";

/**
 * Manages the application's visual themes and asset manifest resolution.
 * Per ADR 0061, it provides a bridge between CSS variables and Canvas rendering.
 */
export class ThemeManager {
  private colorCache: Map<string, string> = new Map();
  private assets: Record<string, string> = {};

  /**
   * Initializes the ThemeManager by loading the asset manifest.
   */
  public async init(): Promise<void> {
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const response = await fetch(
        `${baseUrl}assets/assets.json`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch assets.json: ${response.statusText}`);
      }
      this.assets = await response.json() as Record<string, string>;
    } catch (e: unknown) {
      Logger.error("ThemeManager: Failed to load assets.json", e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Returns the URL for a logical asset name.
   */
  public getAssetUrl(logicalName: string): string | null {
    const path = this.assets[logicalName];
    if (!path) return null;
    const baseUrl = import.meta.env.BASE_URL || "/";
    return `${baseUrl}${path}`;
  }

  /**
   * Clears the color cache.
   */
  public clearCache(): void {
    this.colorCache.clear();
  }

  /**
   * Resolves a CSS variable to its current hex/rgba value.
   * ADR 0061: Resolving from document.body ensures we see theme-specific overrides.
   */
  public getColor(varName: string): string {
    if (this.colorCache.has(varName)) {
      return this.colorCache.get(varName) ?? "";
    }

    if (typeof window === "undefined" || !window.getComputedStyle) {
      return this.getFallbackColor(varName);
    }

    const root = document.body || document.documentElement;
    if (!root) {
      return this.getFallbackColor(varName);
    }

    try {
      const value = window.getComputedStyle(root)
        .getPropertyValue(varName)
        .trim();
      
      if (value && value !== "") {
        this.colorCache.set(varName, value);
        return value;
      }
    } catch (e) {
      // Fall through to fallback
    }

    return this.getFallbackColor(varName);
  }

  /**
   * Sets a color on the canvas context using a CSS variable.
   */
  public applyToCanvas(
    ctx: CanvasRenderingContext2D,
    varName: string,
    mode: "fill" | "stroke" = "fill",
  ): void {
    const color = this.getColor(varName);
    if (mode === "fill") {
      ctx.fillStyle = color;
    } else {
      ctx.strokeStyle = color;
    }
  }

  /**
   * Returns the current theme ID.
   */
  public getCurrentThemeId(): string {
    if (typeof document === "undefined") return "default";
    const body = document.body;
    if (!body) return "default";
    const themeClass = Array.from(body.classList).find(c => c.startsWith("theme-"));
    return themeClass ? themeClass.replace("theme-", "") : "default";
  }

  /**
   * Switches themes by adding/removing classes from the <body> and <html>.
   * This provides global consistency while maintaining backward compatibility.
   */
  public setTheme(themeName: string): void {
    if (typeof document === "undefined") return;
    const targets = [document.documentElement, document.body];
    
    targets.forEach(target => {
      if (!target) return;
      
      // Remove any existing theme- classes robustly (preserves mobile-touch etc)
      const toRemove = Array.from(target.classList).filter(c => c.startsWith("theme-"));
      toRemove.forEach(c => target.classList.remove(c));
      
      // Add new theme class
      target.classList.add(`theme-${themeName}`);
    });

    this.colorCache.clear(); // Clear cache as colors might have changed
  }

  /**
   * Programmatically applies a theme configuration by overriding CSS variables.
   */
  public applyTheme(config: ThemeConfig): void {
    if (typeof document === "undefined") return;
    const root = document.body || document.documentElement;
    if (!root || !root.style) return;

    Object.entries(config.colors).forEach(([name, value]) => {
      // Ensure variable names start with --
      const varName = name.startsWith("--") ? name : `--${name}`;
      root.style.setProperty(varName, value);
    });
    this.colorCache.clear();
  }

  /**
   * Returns the URL for a standard icon.
   */
  public getIconUrl(iconName: string): string {
    const baseUrl = import.meta.env.BASE_URL || "/";
    return (
      `${baseUrl}assets/icons/${iconName.toLowerCase()}.svg`
    );
  }

  private getFallbackColor(varName: string): string {
    const fallbacks: Record<string, string> = {
      "--color-primary": "#00ff00",
      "--color-accent": "#00aaff",
      "--color-danger": "#ff0000",
      "--color-success": "#4caf50",
      "--color-success-muted": "rgba(0, 255, 0, 0.2)",
      "--color-warning": "#ff9800",
      "--color-wall": "#00ffff",
      "--color-floor": "#111111",
      "--color-grid": "#222222",
      "--color-door-closed": "#aaaaaa",
      "--color-door-locked": "#ff0000",
      "--color-door-destroyed": "#550000",
      "--color-los-soldier": "rgba(0, 255, 0, 0.4)",
      "--color-los-enemy": "rgba(255, 0, 0, 0.4)",
      "--color-fog-discovered": "rgba(0, 0, 0, 0.6)",
      "--color-fog-unexplored": "#000000",
      "--color-hive": "#9900ff",
      "--color-info": "#00ffff",
      "--color-black": "#000000",
      "--color-white": "#ffffff",
      "--color-los-soldier-fade": "rgba(0, 255, 0, 0)",
      "--color-los-enemy-fade": "rgba(255, 0, 0, 0)",
      "--color-objective-bg": "rgba(255, 170, 0, 0.1)",
      "--color-spawn-bg": "rgba(255, 0, 0, 0.05)",
      "--color-extraction-bg": "rgba(0, 255, 255, 0.1)",
      "--color-missing": "#f0f",
      "--color-text-dim": "#888888",
      "--color-objective": "#ffff00",
      "--color-connection-active": "#ffffff",
      "--color-connection-cleared": "#00ff00",
      "--color-connection-default": "#aaaaaa",
      "--color-loot-pip-shadow": "rgba(255, 152, 0, 0.5)",
      "--color-wizard-status-bg": "rgba(0, 0, 0, 0.2)",
      "--color-unlock-card-bg": "rgba(0, 255, 0, 0.05)",
      "--color-border-strong": "#444444",
      "--color-primary-glow": "rgba(0, 255, 0, 0.1)",
      "--color-accent-glow": "rgba(0, 170, 255, 0.1)",
    };
    return fallbacks[varName] || "#000000";
  }
}
