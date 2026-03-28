import { createElement, Fragment } from "@src/renderer/jsx";
import type {
  CampaignSoldier,
  SoldierMissionResult} from "@src/shared/campaign_types";
import {
  calculateLevel,
  XP_THRESHOLDS,
} from "@src/shared/campaign_types";
import type {
  Unit,
  Archetype,
  SquadSoldierConfig} from "@src/shared/types";
import {
  UnitState,
  ArchetypeLibrary,
  WeaponLibrary,
  ItemLibrary
} from "@src/shared/types";
import { Icons } from "@src/renderer/Icons";
import { StatDisplayComponent } from "@src/renderer/ui/StatDisplay";
import { UnitUtils } from "@src/shared/utils/UnitUtils";
import { SPEED_NORMALIZATION_CONST } from "@src/shared/constants";
import { t } from "../i18n";
import { I18nKeys } from "../i18n/keys";

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
  onClick?: (e: Event) => void;
  onDoubleClick?: (e: MouseEvent) => void;
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

// --- Helper Functions ---

function getEquipment(data: SoldierWidgetData): {
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

function getName(data: SoldierWidgetData): string {
  if ("name" in data && data.name) return data.name;
  if ("soldierId" in data && data.soldierId) return data.soldierId;
  if ("id" in data && data.id) return data.id;
  return "Unknown";
}

function getTacticalNumber(data: SoldierWidgetData): number | undefined {
  if ("tacticalNumber" in data) return data.tacticalNumber;
  return undefined;
}

function getStatus(data: SoldierWidgetData): string {
  const status: string = "status" in data && data.status
    ? String(data.status)
    : "state" in data && data.state
      ? String(data.state)
      : "Healthy";
  
  if (status === "Healthy" || status === UnitState.Idle) return t(I18nKeys.units.status.functional);
  if (status === "Wounded") return t(I18nKeys.units.status.damaged);
  if (status === "Dead" || status === UnitState.Dead) return t(I18nKeys.units.status.integrity_failure);
  if (status === "Extracted" || status === UnitState.Extracted) return t(I18nKeys.units.status.retrieved);
  
  return status;
}

function getLevel(data: SoldierWidgetData): number {
  if ("level" in data && typeof data.level === "number") return data.level;
  if ("xp" in data && typeof data.xp === "number")
    return calculateLevel(data.xp);
  if ("xpBefore" in data && typeof data.xpBefore === "number")
    return calculateLevel(data.xpBefore);
  return 1;
}

function getItemName(id?: string): string {
  if (!id) return t(I18nKeys.units.empty_weapon);
  const item = WeaponLibrary[id] || ItemLibrary[id];
  return item ? t("units.item." + item.id) : id;
}

function getStatusColor(status: string): string {
  if (status === t(I18nKeys.units.status.functional) || status === t(I18nKeys.units.status.retrieved)) {
      return "var(--color-primary)";
  }
  if (status === t(I18nKeys.units.status.damaged)) {
      return "var(--color-warning)";
  }
  if (status === t(I18nKeys.units.status.integrity_failure)) {
      return "var(--color-danger)";
  }
  return "var(--color-text)";
}

function getWeaponStats(unit: Unit, weaponId?: string): WeaponHUDStats | null {
  if (!weaponId) return null;
  const weapon = WeaponLibrary[weaponId];
  if (!weapon) return null;

  const fireRateVal =
    weapon.fireRate *
    (unit.stats.speed > 0 ? SPEED_NORMALIZATION_CONST / unit.stats.speed : 1);

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

// --- Components ---

export function TacticalSoldier(props: {
  unit: Unit;
  displayName: string;
  options: SoldierWidgetOptions;
}) {
  const { unit, displayName } = props;
  const policyIcon = unit.engagementPolicy === "IGNORE" ? "🏃" : "⚔️";
  const burdenIcon = unit.carriedObjectiveId ? " 📦" : "";

  let statusText: string = unit.state;
  if (unit.activeCommand) {
    const cmd = unit.activeCommand;
    const cmdLabel = cmd.label || cmd.type;
    statusText = `${cmdLabel} (${unit.state})`;
  }
  if (unit.commandQueue && unit.commandQueue.length > 0) {
    statusText += ` (+${unit.commandQueue.length})`;
  }

  const hpPercent =
    unit.state === UnitState.Dead ? 0 : (unit.hp / unit.maxHp) * 100;

  const lhStats = getWeaponStats(unit, unit.leftHand);
  const rhStats = getWeaponStats(unit, unit.rightHand);

  return (
    <Fragment>
      <div class="soldier-info-header">
        <div class="soldier-identity">
          <span class="u-icon">{policyIcon}</span>
          <strong class="u-id">{displayName}</strong>
          <span class="u-burden">{burdenIcon}</span>
        </div>
        <span class="u-hp">
          {unit.hp}/{unit.maxHp}
        </span>
      </div>
      <div class="soldier-base-stats">
        <span class="u-speed-box">
          <StatDisplayComponent
            icon={Icons.Speed}
            value={unit.stats.speed}
            title={t(I18nKeys.hud.stat.speed)}
          />
        </span>
      </div>
      <div class="soldier-weapon-stats">
        <div
          class={`u-lh-row weapon-row ${unit.activeWeaponId === unit.leftHand && !!unit.leftHand ? "active-weapon" : ""}`}
        >
          <span class="weapon-label">LH:</span>
          <span class="u-lh-stats weapon-stats-list">
            {lhStats ? (
              <Fragment>
                <StatDisplayComponent
                  icon={Icons.Damage}
                  value={lhStats.damage}
                  title={t(I18nKeys.hud.stat.damage)}
                />
                <StatDisplayComponent
                  icon={Icons.Accuracy}
                  value={lhStats.accuracy}
                  title={t(I18nKeys.hud.stat.accuracy)}
                />
                <StatDisplayComponent
                  icon={Icons.Rate}
                  value={lhStats.fireRate}
                  title={t(I18nKeys.hud.stat.rate)}
                />
                <StatDisplayComponent
                  icon={Icons.Range}
                  value={lhStats.range}
                  title={t(I18nKeys.hud.stat.range)}
                />
              </Fragment>
            ) : (
              <span class="weapon-empty">{t(I18nKeys.units.empty_weapon)}</span>
            )}
          </span>
        </div>
        <div
          class={`u-rh-row weapon-row ${unit.activeWeaponId === unit.rightHand && !!unit.rightHand ? "active-weapon" : ""}`}
        >
          <span class="weapon-label">RH:</span>
          <span class="u-rh-stats weapon-stats-list">
            {rhStats ? (
              <Fragment>
                <StatDisplayComponent
                  icon={Icons.Damage}
                  value={rhStats.damage}
                  title={t(I18nKeys.hud.stat.damage)}
                />
                <StatDisplayComponent
                  icon={Icons.Accuracy}
                  value={rhStats.accuracy}
                  title={t(I18nKeys.hud.stat.accuracy)}
                />
                <StatDisplayComponent
                  icon={Icons.Rate}
                  value={rhStats.fireRate}
                  title={t(I18nKeys.hud.stat.rate)}
                />
                <StatDisplayComponent
                  icon={Icons.Range}
                  value={rhStats.range}
                  title={t(I18nKeys.hud.stat.range)}
                />
              </Fragment>
            ) : (
              <span class="weapon-empty">{t(I18nKeys.units.empty_weapon)}</span>
            )}
          </span>
        </div>
      </div>
      <div class="soldier-status-row">
        <span class="u-status-text">{statusText}</span>
      </div>
      <div class="hp-bar">
        <div class="hp-fill" style={{ width: `${hpPercent}%` }}></div>
      </div>
    </Fragment>
  );
}

export function DebriefSoldier(props: {
  res: SoldierMissionResult;
  displayName: string;
  currentLevel: number;
}) {
  const { res, displayName, currentLevel } = props;
  const status = getStatus(res);
  const statusColor = getStatusColor(status);

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

  return (
    <Fragment>
      <div class="flex-row justify-between align-center">
        <span class="soldier-name-lvl">
          {displayName} <span class="soldier-lvl">{t(I18nKeys.units.lvl, { level: currentLevel })}</span>
        </span>
        <span
          class="soldier-status-badge"
          style={{ color: statusColor, borderColor: statusColor }}
        >
          {status}
        </span>
      </div>

      <div class="debrief-xp-container">
        <div class="flex-row justify-between xp-text">
          <span>
            {t(I18nKeys.units.xp_gained, { xp: res.xpBefore, xpGained: res.xpGained })}
          </span>
          <span>
            {t(I18nKeys.units.xp_progress, { xpAfter, nextLevelThreshold })}
          </span>
        </div>
        <div class="debrief-xp-bar">
          <div
            class="debrief-xp-fill-before"
            style={{ width: `${progressBefore}%` }}
          ></div>
          <div
            class="debrief-xp-fill-after"
            style={{ width: `${progressAfter}%` }}
          ></div>
        </div>
      </div>

      <div class="flex-row gap-20 debrief-stats-summary">
        <span>
          {t(I18nKeys.screen.debrief.biologicals_neutralized)} <span class="highlight-text">{res.kills}</span>
        </span>
        {res.promoted && (
          <span class="promo-text">{t(I18nKeys.units.level_up)} ({t(I18nKeys.units.lvl, { level: res.newLevel || currentLevel + 1 })})</span>
        )}
        {res.status === "Wounded" && res.recoveryTime && (
          <span class="recovery-text">
            {t(I18nKeys.units.recovery_missions, { missions: res.recoveryTime })}
          </span>
        )}
      </div>
    </Fragment>
  );
}

export function RosterSoldier(props: {
  data: CampaignSoldier | SquadSoldierConfig;
  displayName: string;
  level: number;
  options: SoldierWidgetOptions;
}) {
  const { data, displayName, level, options } = props;
  const status = getStatus(data);
  const statusColor = getStatusColor(status);

  const archId =
    "archetypeId" in data && typeof data.archetypeId === "string"
      ? data.archetypeId
      : "id" in data && typeof data.id === "string"
        ? data.id
        : undefined;

  const archetype =
    (archId && t("units.archetype." + archId)) || archId || "Unknown";

  const equipment = getEquipment(data);
  const rh = getItemName(equipment.rightHand);
  const lh = getItemName(equipment.leftHand);
  const equipmentText = `${rh} / ${lh}`;

  const xp = "xp" in data && typeof data.xp === "number" ? data.xp : 0;
  const hp = "hp" in data && typeof data.hp === "number" ? data.hp : 0;

  const stats = UnitUtils.calculateEffectiveStats(data);
  const maxHp = stats.maxHp;

  return (
    <Fragment>
      <div class="roster-item-header">
        <strong class={options.selected ? "active-name" : ""}>
          {displayName}
        </strong>
        <div class="roster-item-meta">
          {options.price && <span class="roster-price">{options.price}</span>}
          <span class="badge">{t(I18nKeys.units.lvl, { level })}</span>
        </div>
      </div>
      <div class="roster-item-details">
        <span>
          {archetype} | {equipmentText}
        </span>
        <span style={{ color: statusColor }}>{status}</span>
      </div>
      <div class="roster-item-stats">
        {t(I18nKeys.units.hp_xp_stat, { hp, maxHp, xp })}
      </div>
    </Fragment>
  );
}

export function SquadBuilderSoldier(props: {
  data: Archetype | SquadSoldierConfig;
  displayName: string;
  level: number;
  options: SoldierWidgetOptions;
}) {
  const { data, displayName, level, options } = props;
  let arch: Archetype | undefined;

  if ("archetypeId" in data && data.archetypeId) {
    arch = ArchetypeLibrary[data.archetypeId];
  } else if ("id" in data && data.id && ArchetypeLibrary[data.id]) {
    arch = ArchetypeLibrary[data.id];
  }

  const status = getStatus(data);
  const effectiveStats = UnitUtils.calculateEffectiveStats(data as CampaignSoldier | SquadSoldierConfig);
  
  const archName = arch ? t("units.archetype." + arch.id) : "";
  const name = getName(data);
  const subTitle = archName && archName !== name ? `${archName} ` : "";

  return (
    <Fragment>
      <div class="squad-builder-card-header">
        <strong>{displayName}</strong>
        {options.price && (
          <span class="squad-builder-price">{options.price}</span>
        )}
      </div>
      <div class="squad-builder-card-subtitle">
        {subTitle}{t(I18nKeys.units.lvl, { level })} | {t(I18nKeys.units.status_label, { status })}
      </div>
      <div class="squad-builder-card-stats">
        <StatDisplayComponent
          icon={Icons.Speed}
          value={effectiveStats.speed}
          title={t(I18nKeys.hud.stat.speed)}
        />
        <StatDisplayComponent
          icon={Icons.Accuracy}
          value={effectiveStats.accuracy}
          title={t(I18nKeys.hud.stat.accuracy)}
        />
        <StatDisplayComponent
          icon={Icons.Damage}
          value={effectiveStats.damage}
          title={t(I18nKeys.hud.stat.damage)}
        />
        <StatDisplayComponent
          icon={Icons.Rate}
          value={effectiveStats.fireRateDisplay}
          title={t(I18nKeys.hud.stat.shots_per_sec)}
        />
        <StatDisplayComponent
          icon={Icons.Range}
          value={effectiveStats.attackRange}
          title={t(I18nKeys.hud.stat.range)}
        />
      </div>
    </Fragment>
  );
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

  private static applyBaseClasses(container: HTMLElement, options: SoldierWidgetOptions, rawStatus: string) {
    const contextClass = `soldier-widget-${options.context}`;
    if (!container.classList.contains("soldier-widget")) container.classList.add("soldier-widget");
    if (!container.classList.contains("soldier-item")) container.classList.add("soldier-item");
    if (!container.classList.contains(contextClass)) container.classList.add(contextClass);

    if (options.context === "roster") {
      if (!container.classList.contains("menu-item")) container.classList.add("menu-item");
    } else if (options.context === "debrief") {
      if (!container.classList.contains("debrief-item")) container.classList.add("debrief-item");
    } else if (options.context === "squad-builder" || options.context === "tactical") {
      if (!container.classList.contains("soldier-card")) container.classList.add("soldier-card");
    }

    container.classList.toggle("selected", !!options.selected);
    container.classList.toggle("active", !!options.selected && options.context === "roster");
    container.classList.toggle("dead", rawStatus === "Dead");
    container.classList.toggle("wounded", rawStatus === "Wounded");
    container.classList.toggle("extracted", rawStatus === "Extracted");
  }

  private static applyClickHandlers(container: HTMLElement, options: SoldierWidgetOptions) {
    if (!options.onClick) return;
    container.classList.add("clickable");
    container.addEventListener("click", (e) => options.onClick?.(e));
    if (options.onDoubleClick) {
      container.addEventListener("dblclick", (e) => options.onDoubleClick?.(e));
    }
    container.tabIndex = 0;
    container.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { options.onClick?.(e); e.preventDefault(); }
    });
  }

  private static buildContent(params: {
    data: SoldierWidgetData;
    options: SoldierWidgetOptions;
    displayName: string;
    level: number;
    rawStatus: string;
    container: HTMLElement;
  }): HTMLElement | DocumentFragment | undefined {
    const { data, options, displayName, level, rawStatus, container } = params;
    const status = getStatus(data);
    switch (options.context) {
      case "tactical":
        return (<TacticalSoldier unit={data as Unit} displayName={displayName} options={options} />) as HTMLElement;
      case "debrief":
        return (<DebriefSoldier res={data as SoldierMissionResult} displayName={displayName} currentLevel={level} />) as HTMLElement;
      case "roster":
        container.style.borderLeft = `4px solid ${getStatusColor(status)}`;
        return (<RosterSoldier data={data as CampaignSoldier | SquadSoldierConfig} displayName={displayName} level={level} options={options} />) as HTMLElement;
      case "squad-builder":
        container.classList.toggle("deployed", !!options.isDeployed);
        container.classList.toggle("disabled", rawStatus !== "Healthy");
        return (<SquadBuilderSoldier data={data as Archetype | SquadSoldierConfig} displayName={displayName} level={level} options={options} />) as HTMLElement;
    }
  }

  public static update(
    container: HTMLElement,
    data: SoldierWidgetData,
    options: SoldierWidgetOptions,
  ): void {
    const rawStatus = "status" in data && data.status
      ? data.status
      : "state" in data && data.state
        ? data.state
        : "Healthy";

    SoldierWidget.applyBaseClasses(container, options, String(rawStatus));
    SoldierWidget.applyClickHandlers(container, options);

    const name = getName(data);
    const tacticalNumber = getTacticalNumber(data);
    let displayName = tacticalNumber ? `${name} (${tacticalNumber})` : name;
    if (options.prefix) displayName = `${options.prefix}${displayName}`;
    const level = getLevel(data);

    container.innerHTML = "";
    const content = SoldierWidget.buildContent({ data, options, displayName, level, rawStatus: String(rawStatus), container });
    if (content) container.appendChild(content);
  }
}
