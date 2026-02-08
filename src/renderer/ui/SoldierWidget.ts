import {
  CampaignSoldier,
  SoldierMissionResult,
  calculateLevel,
  XP_THRESHOLDS,
} from "@src/shared/campaign_types";
import {
  Unit,
  UnitState,
  ArchetypeLibrary,
  WeaponLibrary,
  ItemLibrary,
  Archetype,
  SquadSoldierConfig,
} from "@src/shared/types";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";

export type SoldierWidgetData =
  | CampaignSoldier
  | Unit
  | SoldierMissionResult
  | Archetype
  | SquadSoldierConfig;

export interface SoldierWidgetOptions {
  context: "tactical" | "debrief" | "roster" | "squad-builder";
  selected?: boolean;
  prefix?: string;
  price?: string;
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
  public static render(
    data: SoldierWidgetData,
    options: SoldierWidgetOptions,
  ): HTMLElement {
    const container = document.createElement("div");
    this.update(container, data, options);
    return container;
  }

  public static update(
    container: HTMLElement,
    data: SoldierWidgetData,
    options: SoldierWidgetOptions,
  ): void {
    const contextClass = `soldier-widget-${options.context}`;
    if (!container.classList.contains("soldier-item"))
      container.classList.add("soldier-item");
    if (!container.classList.contains(contextClass))
      container.classList.add(contextClass);

    // Add context-specific standard classes for styling and tests
    if (options.context === "roster") {
      if (!container.classList.contains("menu-item"))
        container.classList.add("menu-item");
    } else if (options.context === "debrief") {
      if (!container.classList.contains("debrief-item"))
        container.classList.add("debrief-item");
    } else if (options.context === "squad-builder") {
      if (!container.classList.contains("soldier-card"))
        container.classList.add("soldier-card");
    }

    container.classList.toggle("selected", !!options.selected);
    container.classList.toggle(
      "active",
      !!options.selected && options.context === "roster",
    );

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
    let displayName = tacticalNumber ? `${name} (${tacticalNumber})` : name;
    if (options.prefix) {
      displayName = `${options.prefix}${displayName}`;
    }
    const level = this.getLevel(data);

    switch (options.context) {
      case "tactical":
        this.renderTactical(container, data as Unit, options, displayName);
        break;
      case "debrief":
        this.renderDebrief(
          container,
          data as SoldierMissionResult,
          options,
          displayName,
          level,
        );
        break;
      case "roster":
        this.renderRoster(
          container,
          data,
          options,
          displayName,
          level,
        );
        break;
      case "squad-builder":
        this.renderSquadBuilder(
          container,
          data,
          options,
          displayName,
          level,
        );
        break;
    }
  }

  private static getEquipment(data: SoldierWidgetData): {
    rightHand?: string;
    leftHand?: string;
  } {
    if ("equipment" in data && data.equipment) {
      return data.equipment;
    }
    const res: { rightHand?: string; leftHand?: string } = {};
    if ("rightHand" in data && typeof data.rightHand === "string") {
      res.rightHand = data.rightHand;
    }
    if ("leftHand" in data && typeof data.leftHand === "string") {
      res.leftHand = data.leftHand;
    }
    return res;
  }

  private static getName(data: SoldierWidgetData): string {
    if ("name" in data && data.name) return data.name;
    if ("soldierId" in data && data.soldierId) return data.soldierId;
    if ("id" in data && data.id) return data.id;
    return "Unknown";
  }

  private static getTacticalNumber(
    data: SoldierWidgetData,
  ): number | undefined {
    if ("tacticalNumber" in data) return data.tacticalNumber;
    return undefined;
  }

  private static getStatus(data: SoldierWidgetData): string {
    if ("status" in data && data.status) return data.status;
    if ("state" in data && data.state) return data.state;
    return "Healthy";
  }

  private static getLevel(data: SoldierWidgetData): number {
    if ("level" in data && typeof data.level === "number") return data.level;
    if ("xp" in data && typeof data.xp === "number") return calculateLevel(data.xp);
    if ("xpBefore" in data && typeof data.xpBefore === "number") return calculateLevel(data.xpBefore);
    return 1;
  }

  private static getItemName(id?: string): string {
    if (!id) return "Empty";
    const item = WeaponLibrary[id] || ItemLibrary[id];
    return item ? item.name : id;
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

  private static getWeaponStats(
    unit: Unit,
    weaponId?: string,
  ): WeaponHUDStats | null {
    if (!weaponId) return null;
    const weapon = WeaponLibrary[weaponId];
    if (!weapon) return null;

    const fireRateVal =
      weapon.fireRate * (unit.stats.speed > 0 ? 10 / unit.stats.speed : 1);

    return {
      name: weapon.name,
      damage: weapon.damage,
      range: weapon.range,
      accuracy:
        unit.stats.soldierAim +
        (weapon.accuracy || 0) +
        (unit.stats.equipmentAccuracyBonus || 0),
      fireRate: fireRateVal > 0 ? (1000 / fireRateVal).toFixed(1) : "0",
    };
  }

  private static renderTactical(
    el: HTMLElement,
    unit: Unit,
    _options: SoldierWidgetOptions,
    displayName: string,
  ) {
    if (!el.hasChildNodes()) {
      el.innerHTML = `
        <div class="soldier-info-header">
          <div class="soldier-identity">
             <span class="u-icon"></span>
             <strong class="u-id"></strong>
             <span class="u-burden"></span>
          </div>
          <span class="u-hp"></span>
        </div>
        <div class="soldier-base-stats">
           <span class="u-speed-box"></span>
        </div>
        <div class="soldier-weapon-stats">
           <div class="u-lh-row weapon-row">
              <span class="weapon-label">LH:</span>
              <span class="u-lh-stats weapon-stats-list"></span>
           </div>
           <div class="u-rh-row weapon-row">
              <span class="weapon-label">RH:</span>
              <span class="u-rh-stats weapon-stats-list"></span>
           </div>
        </div>
        <div class="soldier-status-row">
             <span class="u-status-text"></span>
        </div>
        <div class="hp-bar"><div class="hp-fill"></div></div>
      `;
    }

    const policyIcon = unit.engagementPolicy === "IGNORE" ? "🏃" : "⚔️";
    const iconSpan = el.querySelector(".u-icon") as HTMLElement;
    if (iconSpan.textContent !== policyIcon) iconSpan.textContent = policyIcon;

    const idSpan = el.querySelector(".u-id") as HTMLElement;
    if (idSpan.textContent !== displayName) idSpan.textContent = displayName;

    const burdenIcon = unit.carriedObjectiveId ? " 📦" : "";
    const burdenSpan = el.querySelector(".u-burden") as HTMLElement;
    if (burdenSpan.textContent !== burdenIcon)
      burdenSpan.textContent = burdenIcon;

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
    if (statusSpan.textContent !== statusText)
      statusSpan.textContent = statusText;

    const hpSpan = el.querySelector(".u-hp") as HTMLElement;
    const hpStr = `${unit.hp}/${unit.maxHp}`;
    if (hpSpan.textContent !== hpStr) hpSpan.textContent = hpStr;

    const hpFill = el.querySelector(".hp-fill") as HTMLElement;
    const hpPercent =
      unit.state === UnitState.Dead ? 0 : (unit.hp / unit.maxHp) * 100;
    const hpWidth = `${hpPercent}%`;
    if (hpFill.style.width !== hpWidth) hpFill.style.width = hpWidth;

    const speedBox = el.querySelector(".u-speed-box") as HTMLElement;
    if (!speedBox.hasChildNodes()) {
      speedBox.innerHTML = StatDisplay.render(
        Icons.Speed,
        unit.stats.speed,
        "Speed",
      );
    } else {
      StatDisplay.update(speedBox, unit.stats.speed);
    }

    const lhStats = this.getWeaponStats(unit, unit.leftHand);
    const rhStats = this.getWeaponStats(unit, unit.rightHand);

    const updateWep = (
      container: HTMLElement,
      stats: WeaponHUDStats | null,
    ) => {
      if (!stats) {
        const emptyHtml = '<span class="weapon-empty">Empty</span>';
        if (container.innerHTML !== emptyHtml) container.innerHTML = emptyHtml;
        return;
      }

      if (
        !container.querySelector(".stat-display") ||
        container.textContent === "Empty"
      ) {
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
    lhRow.classList.toggle(
      "active-weapon",
      unit.activeWeaponId === unit.leftHand && !!unit.leftHand,
    );
    rhRow.classList.toggle(
      "active-weapon",
      unit.activeWeaponId === unit.rightHand && !!unit.rightHand,
    );
  }

  private static renderDebrief(
    container: HTMLElement,
    res: SoldierMissionResult,
    _options: SoldierWidgetOptions,
    displayName: string,
    currentLevel: number,
  ) {
    const statusColor = this.getStatusColor(res.status);

    const nextLevelThreshold =
      XP_THRESHOLDS[currentLevel] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
    const prevLevelThreshold = XP_THRESHOLDS[currentLevel - 1] || 0;

    const xpInCurrentLevel = res.xpBefore - prevLevelThreshold;
    const xpNeededForNext = nextLevelThreshold - prevLevelThreshold;
    const xpAfter = res.xpBefore + res.xpGained;
    const xpInCurrentLevelAfter =
      Math.min(xpAfter, nextLevelThreshold) - prevLevelThreshold;

    const progressBefore = (xpInCurrentLevel / xpNeededForNext) * 100;
    const progressAfter = (xpInCurrentLevelAfter / xpNeededForNext) * 100;

    container.innerHTML = `
      <div class="flex-row justify-between align-center">
        <span class="soldier-name-lvl">${displayName} <span class="soldier-lvl">LVL ${currentLevel}</span></span>
        <span class="soldier-status-badge" style="color:${statusColor}; border-color: ${statusColor};">
          ${res.status}
        </span>
      </div>
      
      <div class="debrief-xp-container">
        <div class="flex-row justify-between xp-text">
          <span>XP: ${res.xpBefore} (+${res.xpGained})</span>
          <span>${xpAfter} / ${nextLevelThreshold}</span>
        </div>
        <div class="debrief-xp-bar">
          <div class="debrief-xp-fill-before" style="width: ${progressBefore}%;"></div>
          <div class="debrief-xp-fill-after" style="width: ${progressAfter}%;"></div>
        </div>
      </div>

      <div class="flex-row gap-20 debrief-stats-summary">
        <span>Kills: <span class="highlight-text">${res.kills}</span></span>
        ${res.promoted ? `<span class="promo-text">Level Up! (LVL ${res.newLevel})</span>` : ""}
        ${res.status === "Wounded" && res.recoveryTime ? `<span class="recovery-text">Recovery: ${res.recoveryTime} Missions</span>` : ""}
      </div>
    `;
  }

  private static renderRoster(
    container: HTMLElement,
    data: SoldierWidgetData,
    options: SoldierWidgetOptions,
    displayName: string,
    level: number,
  ) {
    const status = this.getStatus(data);
    const statusColor = this.getStatusColor(status);
    
    const archId = "archetypeId" in data && typeof data.archetypeId === "string" 
      ? data.archetypeId 
      : ("id" in data && typeof data.id === "string" ? data.id : undefined);
    
    const archetype =
      (archId && ArchetypeLibrary[archId]?.name) || archId || "Unknown";

    const equipment = this.getEquipment(data);
    const rh = this.getItemName(equipment.rightHand);
    const lh = this.getItemName(equipment.leftHand);
    const equipmentText = `${rh} / ${lh}`;

    const xp = "xp" in data && typeof data.xp === "number" ? data.xp : 0;
    const hp = "hp" in data && typeof data.hp === "number" ? data.hp : 0;
    const maxHp = "maxHp" in data && typeof data.maxHp === "number" ? data.maxHp : 0;

    container.style.borderLeft = `4px solid ${statusColor}`;

    container.innerHTML = `
      <div class="roster-item-header">
        <strong class="${options.selected ? "active-name" : ""}">${displayName}</strong>
        <div class="roster-item-meta">
          ${options.price ? `<span class="roster-price">${options.price}</span>` : ""}
          <span class="badge">LVL ${level}</span>
        </div>
      </div>
      <div class="roster-item-details">
        <span>${archetype} | ${equipmentText}</span>
        <span style="color:${statusColor};">${status}</span>
      </div>
      <div class="roster-item-stats">
        HP: ${hp}/${maxHp} | XP: ${xp}
      </div>
    `;
  }

  private static renderSquadBuilder(
    container: HTMLElement,
    data: SoldierWidgetData,
    options: SoldierWidgetOptions,
    displayName: string,
    level: number,
  ) {
    let arch: Archetype | undefined;
    let status = "Healthy";

    if ("archetypeId" in data && data.archetypeId) {
      arch = ArchetypeLibrary[data.archetypeId];
      if ("status" in data && data.status) status = data.status;
    } else if ("id" in data && data.id && ArchetypeLibrary[data.id]) {
      arch = ArchetypeLibrary[data.id];
    }

    container.classList.toggle("deployed", !!options.isDeployed);

    const isHealthy = status === "Healthy";
    container.classList.toggle("disabled", !isHealthy);

    const speed = arch?.speed ?? 0;
    const accuracy = arch?.soldierAim ?? 0;
    const damage = arch?.damage ?? 0;
    const fireRate = arch?.fireRate ?? 0;
    const range = arch?.attackRange ?? 0;

    const scaledFireRate = fireRate * (speed > 0 ? 10 / speed : 1);
    const fireRateVal =
      scaledFireRate > 0 ? (1000 / scaledFireRate).toFixed(1) : "0";

    const name = this.getName(data);
    const subTitle = (arch?.name && arch.name !== name) ? `${arch.name} ` : "";

    container.innerHTML = `
      <div class="squad-builder-card-header">
        <strong>${displayName}</strong>
        ${options.price ? `<span class="squad-builder-price">${options.price}</span>` : ""}
      </div>
      <div class="squad-builder-card-subtitle">
        ${subTitle}Lvl ${level} | Status: ${status}
      </div>
      <div class="squad-builder-card-stats">
        ${StatDisplay.render(Icons.Speed, speed, "Speed")}
        ${StatDisplay.render(Icons.Accuracy, accuracy, "Accuracy")}
        ${StatDisplay.render(Icons.Damage, damage, "Damage")}
        ${StatDisplay.render(Icons.Rate, fireRateVal, "Fire Rate")}
        ${StatDisplay.render(Icons.Range, range, "Range")}
      </div>
    `;
  }
}