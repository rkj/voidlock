import { createElement, Fragment } from "@src/renderer/jsx";
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
import { StatDisplayComponent } from "@src/renderer/ui/StatDisplay";
import { UnitUtils } from "@src/shared/utils/UnitUtils";
import { SPEED_NORMALIZATION_CONST } from "@src/shared/constants";

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
  const status = "status" in data && data.status
    ? data.status
    : "state" in data && data.state
      ? data.state
      : "Healthy";
  
  if (status === "Healthy") return "Functional";
  if (status === "Wounded") return "Damaged";
  if (status === "Dead") return "Integrity Failure";
  if (status === "Extracted") return "Retrieved";
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
  if (!id) return "Empty";
  const item = WeaponLibrary[id] || ItemLibrary[id];
  return item ? item.name : id;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "Functional":
    case "Retrieved":
      return "var(--color-primary)";
    case "Damaged":
      return "var(--color-warning)";
    case "Integrity Failure":
      return "var(--color-danger)";
    default:
      return "var(--color-text)";
  }
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
            title="Operational Speed"
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
                  title="Damage"
                />
                <StatDisplayComponent
                  icon={Icons.Accuracy}
                  value={lhStats.accuracy}
                  title="Accuracy"
                />
                <StatDisplayComponent
                  icon={Icons.Rate}
                  value={lhStats.fireRate}
                  title="Terminal Feed Delay (Shots/sec)"
                />
                <StatDisplayComponent
                  icon={Icons.Range}
                  value={lhStats.range}
                  title="Range"
                />
              </Fragment>
            ) : (
              <span class="weapon-empty">Empty</span>
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
                  title="Damage"
                />
                <StatDisplayComponent
                  icon={Icons.Accuracy}
                  value={rhStats.accuracy}
                  title="Accuracy"
                />
                <StatDisplayComponent
                  icon={Icons.Rate}
                  value={rhStats.fireRate}
                  title="Terminal Feed Delay (Shots/sec)"
                />
                <StatDisplayComponent
                  icon={Icons.Range}
                  value={rhStats.range}
                  title="Range"
                />
              </Fragment>
            ) : (
              <span class="weapon-empty">Empty</span>
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
          {displayName} <span class="soldier-lvl">Lvl {currentLevel}</span>
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
            XP: {res.xpBefore} (+{res.xpGained})
          </span>
          <span>
            {xpAfter} / {nextLevelThreshold}
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
          Hostiles Neutralized: <span class="highlight-text">{res.kills}</span>
        </span>
        {res.promoted && (
          <span class="promo-text">Level Up! (Lvl {res.newLevel})</span>
        )}
        {res.status === "Wounded" && res.recoveryTime && (
          <span class="recovery-text">
            Recovery: {res.recoveryTime} Missions
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
    (archId && ArchetypeLibrary[archId]?.name) || archId || "Unknown";

  const equipment = getEquipment(data);
  const rh = getItemName(equipment.rightHand);
  const lh = getItemName(equipment.leftHand);
  const equipmentText = `${rh} / ${lh}`;

  const xp = "xp" in data && typeof data.xp === "number" ? data.xp : 0;
  const hp = "hp" in data && typeof data.hp === "number" ? data.hp : 0;

  const stats = UnitUtils.calculateEffectiveStats(data as any);
  const maxHp = stats.maxHp;

  return (
    <Fragment>
      <div class="roster-item-header">
        <strong class={options.selected ? "active-name" : ""}>
          {displayName}
        </strong>
        <div class="roster-item-meta">
          {options.price && <span class="roster-price">{options.price}</span>}
          <span class="badge">Lvl {level}</span>
        </div>
      </div>
      <div class="roster-item-details">
        <span>
          {archetype} | {equipmentText}
        </span>
        <span style={{ color: statusColor }}>{status}</span>
      </div>
      <div class="roster-item-stats">
        HP: {hp}/{maxHp} | XP: {xp}
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
  const effectiveStats = UnitUtils.calculateEffectiveStats(data as any);
  const name = getName(data);
  const subTitle = arch?.name && arch.name !== name ? `${arch.name} ` : "";

  return (
    <Fragment>
      <div class="squad-builder-card-header">
        <strong>{displayName}</strong>
        {options.price && (
          <span class="squad-builder-price">{options.price}</span>
        )}
      </div>
      <div class="squad-builder-card-subtitle">
        {subTitle}Lvl {level} | Status: {status}
      </div>
      <div class="squad-builder-card-stats">
        <StatDisplayComponent
          icon={Icons.Speed}
          value={effectiveStats.speed}
          title="Speed"
        />
        <StatDisplayComponent
          icon={Icons.Accuracy}
          value={effectiveStats.accuracy}
          title="Accuracy"
        />
        <StatDisplayComponent
          icon={Icons.Damage}
          value={effectiveStats.damage}
          title="Damage"
        />
        <StatDisplayComponent
          icon={Icons.Rate}
          value={effectiveStats.fireRateDisplay}
          title="Shots per Second"
        />
        <StatDisplayComponent
          icon={Icons.Range}
          value={effectiveStats.attackRange}
          title="Range"
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

  public static update(
    container: HTMLElement,
    data: SoldierWidgetData,
    options: SoldierWidgetOptions,
  ): void {
    const contextClass = `soldier-widget-${options.context}`;
    if (!container.classList.contains("soldier-widget"))
      container.classList.add("soldier-widget");
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
    } else if (options.context === "squad-builder" || options.context === "tactical") {
      if (!container.classList.contains("soldier-card"))
        container.classList.add("soldier-card");
    }

    container.classList.toggle("selected", !!options.selected);
    container.classList.toggle(
      "active",
      !!options.selected && options.context === "roster",
    );

    const rawStatus = "status" in data && data.status
      ? data.status
      : "state" in data && data.state
        ? data.state
        : "Healthy";

    container.classList.toggle("dead", rawStatus === "Dead");
    container.classList.toggle("wounded", rawStatus === "Wounded");
    container.classList.toggle("extracted", rawStatus === "Extracted");

    if (options.onClick) {
      container.classList.add("clickable");
      container.addEventListener("click", (e) => options.onClick!(e));
      if (options.onDoubleClick) {
        container.addEventListener("dblclick", (e) => options.onDoubleClick!(e));
      }
      container.tabIndex = 0;
      container.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          options.onClick!(e);
          e.preventDefault();
        }
      });
    }

    const name = getName(data);
    const tacticalNumber = getTacticalNumber(data);
    let displayName = tacticalNumber ? `${name} (${tacticalNumber})` : name;
    if (options.prefix) {
      displayName = `${options.prefix}${displayName}`;
    }
    const level = getLevel(data);

    // Context-specific rendering
    container.innerHTML = "";
    let content: HTMLElement | DocumentFragment;

    switch (options.context) {
      case "tactical":
        content = (
          <TacticalSoldier
            unit={data as Unit}
            displayName={displayName}
            options={options}
          />
        );
        break;
      case "debrief":
        content = (
          <DebriefSoldier
            res={data as SoldierMissionResult}
            displayName={displayName}
            currentLevel={level}
          />
        );
        break;
      case "roster":
        content = (
          <RosterSoldier
            data={data as CampaignSoldier | SquadSoldierConfig}
            displayName={displayName}
            level={level}
            options={options}
          />
        );
        if (options.context === "roster") {
          container.style.borderLeft = `4px solid ${getStatusColor(status)}`;
        }
        break;
      case "squad-builder":
        content = (
          <SquadBuilderSoldier
            data={data as Archetype | SquadSoldierConfig}
            displayName={displayName}
            level={level}
            options={options}
          />
        );
        container.classList.toggle("deployed", !!options.isDeployed);
        const isHealthy = rawStatus === "Healthy";
        container.classList.toggle("disabled", !isHealthy);
        break;
    }

    if (content) {
      container.appendChild(content);
    }
  }
}
