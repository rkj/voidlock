import { CampaignSoldier, SoldierMissionResult, calculateLevel, XP_THRESHOLDS } from "@src/shared/campaign_types";
import { Unit, UnitState, ArchetypeLibrary, WeaponLibrary } from "@src/shared/types";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";

export type SoldierWidgetData = CampaignSoldier | Unit | SoldierMissionResult;

export interface SoldierWidgetOptions {
  context: "tactical" | "debrief" | "roster" | "squad-builder";
  selected?: boolean;
  onClick?: (e: MouseEvent) => void;
  onRename?: () => void;
  isDeployed?: boolean; // for squad-builder
}

interface WeaponHUDStats {
  name: string;
  damage: number;
  range: number;
  accuracy: number;
  fireRate: string;
}

export class SoldierWidget {
  public static render(data: SoldierWidgetData, options: SoldierWidgetOptions): HTMLElement {
    const container = document.createElement("div");
    this.update(container, data, options);
    return container;
  }

  public static update(container: HTMLElement, data: SoldierWidgetData, options: SoldierWidgetOptions): void {
    const contextClass = `soldier-widget-${options.context}`;
    if (!container.classList.contains("soldier-item")) container.classList.add("soldier-item");
    if (!container.classList.contains(contextClass)) container.classList.add(contextClass);
    
    container.classList.toggle("selected", !!options.selected);
    container.classList.toggle("active", !!options.selected && options.context === "roster");
    
    const status = this.getStatus(data);
    container.classList.toggle("dead", status === "Dead");
    container.classList.toggle("wounded", status === "Wounded");
    container.classList.toggle("extracted", status === "Extracted");

    if (options.onClick) {
      container.classList.add("clickable");
      container.onclick = options.onClick;
    }

    const name = this.getName(data);
    const tacticalNumber = this.getTacticalNumber(data);
    const displayName = tacticalNumber ? `${name} (${tacticalNumber})` : name;
    const level = this.getLevel(data);

    switch (options.context) {
      case "tactical":
        this.renderTactical(container, data as Unit, options, displayName);
        break;
      case "debrief":
        this.renderDebrief(container, data as SoldierMissionResult, options, displayName, level);
        break;
      case "roster":
        this.renderRoster(container, data as CampaignSoldier, options, displayName, level);
        break;
      case "squad-builder":
        this.renderSquadBuilder(container, data as CampaignSoldier, options, displayName, level);
        break;
    }
  }

  private static getName(data: SoldierWidgetData): string {
    if ("name" in data && data.name) return data.name;
    if ("soldierId" in data) return data.soldierId;
    if ("id" in data) return data.id;
    return "Unknown";
  }

  private static getTacticalNumber(data: SoldierWidgetData): number | undefined {
    if ("tacticalNumber" in data) return data.tacticalNumber;
    return undefined;
  }

  private static getStatus(data: SoldierWidgetData): string {
    if ("status" in data) return data.status;
    if ("state" in data) return data.state;
    return "Healthy";
  }

  private static getLevel(data: SoldierWidgetData): number {
    if ("level" in data) return data.level;
    if ("xp" in data) return calculateLevel((data as any).xp);
    if ("xpBefore" in data) return calculateLevel(data.xpBefore);
    return 1;
  }

  private static getStatusColor(status: string): string {
    switch (status) {
      case "Healthy":
      case "Extracted":
        return "var(--color-primary)";
      case "Wounded":
        return "var(--color-warning)";
      case "Dead":
        return "var(--color-danger)";
      default:
        return "var(--color-text)";
    }
  }

  private static getWeaponStats(unit: Unit, weaponId?: string): WeaponHUDStats | null {
    if (!weaponId) return null;
    const weapon = WeaponLibrary[weaponId];
    if (!weapon) return null;

    const fireRateVal = weapon.fireRate * (unit.stats.speed > 0 ? 10 / unit.stats.speed : 1);

    return {
      name: weapon.name,
      damage: weapon.damage,
      range: weapon.range,
      accuracy: unit.stats.soldierAim + (weapon.accuracy || 0) + (unit.stats.equipmentAccuracyBonus || 0),
      fireRate: fireRateVal > 0 ? (1000 / fireRateVal).toFixed(1) : "0",
    };
  }

  private static renderTactical(el: HTMLElement, unit: Unit, _options: SoldierWidgetOptions, displayName: string) {
    if (!el.hasChildNodes()) {
      el.innerHTML = `
        <div class="info-row" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px;">
             <span class="u-icon" style="font-size:1.2em;"></span>
             <strong class="u-id"></strong>
             <span class="u-burden" style="color:var(--color-danger); font-size:1em;"></span>
          </div>
          <span class="u-hp" style="font-weight:bold;"></span>
        </div>
        <div class="base-stats-row" style="font-size:0.7em; display:flex; gap:8px; color:var(--color-text-muted); margin-top:2px;">
           <span class="u-speed-box"></span>
        </div>
        <div class="weapon-stats-container" style="font-size:0.65em; margin-top:4px; display:flex; flex-direction:column; gap:2px; border-top:1px solid var(--color-surface-elevated); padding-top:2px;">
           <div class="u-lh-row" style="display:flex; gap:6px; align-items:center; padding: 1px 2px;">
              <span style="color:var(--color-text-dim); flex: 0 0 24px;">LH:</span>
              <span class="u-lh-stats" style="display:flex; gap:8px;"></span>
           </div>
           <div class="u-rh-row" style="display:flex; gap:6px; align-items:center; padding: 1px 2px;">
              <span style="color:var(--color-text-dim); flex: 0 0 24px;">RH:</span>
              <span class="u-rh-stats" style="display:flex; gap:8px;"></span>
           </div>
        </div>
        <div class="status-row" style="font-size:0.75em; color:var(--color-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">
             <span class="u-status-text"></span>
        </div>
        <div class="hp-bar" style="margin-top:2px;"><div class="hp-fill"></div></div>
      `;
    }

    const policyIcon = unit.engagementPolicy === "IGNORE" ? "🏃" : "⚔️";
    const iconSpan = el.querySelector(".u-icon") as HTMLElement;
    if (iconSpan.textContent !== policyIcon) iconSpan.textContent = policyIcon;

    const idSpan = el.querySelector(".u-id") as HTMLElement;
    if (idSpan.textContent !== displayName) idSpan.textContent = displayName;

    const burdenIcon = unit.carriedObjectiveId ? " 📦" : "";
    const burdenSpan = el.querySelector(".u-burden") as HTMLElement;
    if (burdenSpan.textContent !== burdenIcon) burdenSpan.textContent = burdenIcon;

    let statusText: string = unit.state;
    if (unit.activeCommand) {
      const cmd = unit.activeCommand;
      const cmdLabel = cmd.label || cmd.type;
      statusText = `${cmdLabel} (${unit.state})`;
    }
    if (unit.commandQueue && unit.commandQueue.length > 0) {
      statusText += ` (+${unit.commandQueue.length})`;
    }
    const statusSpan = el.querySelector(".u-status-text") as HTMLElement;
    if (statusSpan.textContent !== statusText) statusSpan.textContent = statusText;

    const hpSpan = el.querySelector(".u-hp") as HTMLElement;
    const hpStr = `${unit.hp}/${unit.maxHp}`;
    if (hpSpan.textContent !== hpStr) hpSpan.textContent = hpStr;

    const hpFill = el.querySelector(".hp-fill") as HTMLElement;
    const hpPercent = unit.state === UnitState.Dead ? 0 : (unit.hp / unit.maxHp) * 100;
    const hpWidth = `${hpPercent}%`;
    if (hpFill.style.width !== hpWidth) hpFill.style.width = hpWidth;

    const speedBox = el.querySelector(".u-speed-box") as HTMLElement;
    if (!speedBox.hasChildNodes()) {
      speedBox.innerHTML = StatDisplay.render(Icons.Speed, unit.stats.speed, "Speed");
    } else {
      StatDisplay.update(speedBox, unit.stats.speed);
    }

    const lhStats = this.getWeaponStats(unit, unit.leftHand);
    const rhStats = this.getWeaponStats(unit, unit.rightHand);

    const updateWep = (container: HTMLElement, stats: WeaponHUDStats | null) => {
      if (!stats) {
        const emptyHtml = '<span style="color:var(--color-border-strong)">Empty</span>';
        if (container.innerHTML !== emptyHtml) container.innerHTML = emptyHtml;
        return;
      }

      if (!container.querySelector(".stat-display") || container.textContent === "Empty") {
        container.innerHTML = `
          ${StatDisplay.render(Icons.Damage, stats.damage, "Damage")}
          ${StatDisplay.render(Icons.Accuracy, stats.accuracy, "Accuracy")}
          ${StatDisplay.render(Icons.Rate, stats.fireRate, "Fire Rate")}
          ${StatDisplay.render(Icons.Range, stats.range, "Range")}
        `;
      } else {
        const statsEls = container.querySelectorAll(".stat-display");
        if (statsEls.length === 4) {
          StatDisplay.update(statsEls[0] as HTMLElement, stats.damage);
          StatDisplay.update(statsEls[1] as HTMLElement, stats.accuracy);
          StatDisplay.update(statsEls[2] as HTMLElement, stats.fireRate);
          StatDisplay.update(statsEls[3] as HTMLElement, stats.range);
        }
      }
    };

    updateWep(el.querySelector(".u-lh-stats") as HTMLElement, lhStats);
    updateWep(el.querySelector(".u-rh-stats") as HTMLElement, rhStats);

    const lhRow = el.querySelector(".u-lh-row") as HTMLElement;
    const rhRow = el.querySelector(".u-rh-row") as HTMLElement;
    if (unit.activeWeaponId === unit.leftHand && unit.leftHand) {
      lhRow.style.background = "var(--color-surface-elevated)";
      rhRow.style.background = "transparent";
    } else if (unit.activeWeaponId === unit.rightHand && unit.rightHand) {
      rhRow.style.background = "var(--color-surface-elevated)";
      lhRow.style.background = "transparent";
    } else {
      lhRow.style.background = "transparent";
      rhRow.style.background = "transparent";
    }
  }

  private static renderDebrief(container: HTMLElement, res: SoldierMissionResult, _options: SoldierWidgetOptions, displayName: string, currentLevel: number) {
    const statusColor = this.getStatusColor(res.status);

    const nextLevelThreshold = XP_THRESHOLDS[currentLevel] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
    const prevLevelThreshold = XP_THRESHOLDS[currentLevel - 1] || 0;

    const xpInCurrentLevel = res.xpBefore - prevLevelThreshold;
    const xpNeededForNext = nextLevelThreshold - prevLevelThreshold;
    const xpAfter = res.xpBefore + res.xpGained;
    const xpInCurrentLevelAfter = Math.min(xpAfter, nextLevelThreshold) - prevLevelThreshold;

    const progressBefore = (xpInCurrentLevel / xpNeededForNext) * 100;
    const progressAfter = (xpInCurrentLevelAfter / xpNeededForNext) * 100;

    container.innerHTML = `
      <div class="flex-row justify-between align-center">
        <span style="font-size: 1.1em; font-weight:bold;">${displayName} <span style="font-size: 0.7em; color: var(--color-text-muted); font-weight: normal;">LVL ${currentLevel}</span></span>
        <span style="color:${statusColor}; font-weight:bold; border: 1px solid ${statusColor}; padding: 2px 8px; font-size: 0.8em; border-radius: 4px;">
          ${res.status}
        </span>
      </div>
      
      <div class="debrief-xp-container" style="margin-top: 8px;">
        <div class="flex-row justify-between" style="font-size: 0.75em; color: var(--color-text-muted); margin-bottom: 4px;">
          <span>XP: ${res.xpBefore} (+${res.xpGained})</span>
          <span>${xpAfter} / ${nextLevelThreshold}</span>
        </div>
        <div class="debrief-xp-bar">
          <div class="debrief-xp-fill-before" style="width: ${progressBefore}%;"></div>
          <div class="debrief-xp-fill-after" style="width: ${progressAfter}%;"></div>
        </div>
      </div>

      <div class="flex-row gap-20" style="margin-top: 10px; font-size: 0.85em; color: var(--color-text-muted);">
        <span>Kills: <span style="color:var(--color-text);">${res.kills}</span></span>
        ${res.promoted ? `<span style="color:var(--color-accent); font-weight:bold;">Level Up! (LVL ${res.newLevel})</span>` : ""}
        ${res.status === "Wounded" && res.recoveryTime ? `<span style="color:var(--color-warning);">Recovery: ${res.recoveryTime} Missions</span>` : ""}
      </div>
    `;
  }

  private static renderRoster(container: HTMLElement, soldier: CampaignSoldier, options: SoldierWidgetOptions, displayName: string, level: number) {
    const statusColor = this.getStatusColor(soldier.status);
    const archetype = ArchetypeLibrary[soldier.archetypeId]?.name || soldier.archetypeId;

    container.style.marginBottom = "10px";
    container.style.padding = "10px";
    container.style.borderLeft = `4px solid ${statusColor}`;

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="color:${options.selected ? "var(--color-accent)" : "var(--color-text)"};">${displayName}</strong>
        <span class="badge">LVL ${level}</span>
      </div>
      <div style="font-size:0.75em; color:var(--color-text-muted); margin-top:4px; display:flex; justify-content:space-between;">
        <span>${archetype}</span>
        <span style="color:${statusColor};">${soldier.status}</span>
      </div>
      <div style="font-size:0.7em; color:var(--color-text-dim); margin-top:4px;">
        HP: ${soldier.hp}/${soldier.maxHp} | XP: ${soldier.xp}
      </div>
    `;
  }

  private static renderSquadBuilder(container: HTMLElement, soldier: CampaignSoldier, options: SoldierWidgetOptions, displayName: string, level: number) {
    const arch = ArchetypeLibrary[soldier.archetypeId];
    
    if (!container.classList.contains("soldier-card")) container.classList.add("soldier-card");
    container.classList.toggle("deployed", !!options.isDeployed);
    
    const isHealthy = soldier.status === "Healthy";
    container.classList.toggle("disabled", !isHealthy);

    container.innerHTML = `
      <strong>${displayName}</strong>
      <div style="font-size:0.75em; color:var(--color-text-muted);">
        ${arch?.name || soldier.archetypeId} Lvl ${level} | Status: ${soldier.status}
      </div>
    `;
  }
}

