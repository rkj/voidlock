import { createElement, Fragment } from "@src/renderer/jsx";
import type { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import type { CampaignSoldier, CampaignState } from "@src/shared/campaign_types";
import type {
  Item,
  Weapon,
  EquipmentState,
  SquadSoldierConfig} from "@src/shared/types";
import {
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary
} from "@src/shared/types";
import { Icons } from "@src/renderer/Icons";
import { StatDisplayComponent } from "@src/renderer/ui/StatDisplay";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";
import { SPEED_NORMALIZATION_CONST } from "@src/shared/constants";
import { t } from "../i18n";
import { I18nKeys } from "../i18n/keys";

import type { ModalService } from "@src/renderer/ui/ModalService";

export interface SoldierInspectorOptions {
  manager: CampaignManager;
  onUpdate: () => void;
  onRecruit?: (soldierId: string) => void;
  onRevive?: (soldierId: string) => void;
  modalService: ModalService;
}

interface WeaponStats {
  name: string;
  damage: number;
  range: number;
  fireRate: string;
  accuracy: number;
}

export class SoldierInspector {
  private manager: CampaignManager;
  private onUpdate: () => void;
  private onRecruit?: (soldierId: string) => void;
  private onRevive?: (soldierId: string) => void;
  private modalService: ModalService;

  private soldier: CampaignSoldier | SquadSoldierConfig | null = null;
  private isShop: boolean = false;
  private isCampaign: boolean = false;
  private isLocked: boolean = false;

  constructor(options: SoldierInspectorOptions) {
    this.manager = options.manager;
    this.onUpdate = options.onUpdate;
    this.onRecruit = options.onRecruit;
    this.onRevive = options.onRevive;
    this.modalService = options.modalService;
  }

  public setSoldier(soldier: CampaignSoldier | SquadSoldierConfig | null) {
    this.soldier = soldier;
  }

  public setShop(isShop: boolean) {
    this.isShop = isShop;
  }

  public setCampaign(isCampaign: boolean) {
    this.isCampaign = isCampaign;
  }

  public setLocked(locked: boolean) {
    this.isLocked = locked;
  }

  private isDead(): boolean {
    if (!this.soldier || !("id" in this.soldier) || !this.soldier.id || !this.isCampaign)
      return false;
    const state = this.manager.getState();
    const rosterSoldier = state?.roster.find((s) => s.id === this.soldier?.id);
    return rosterSoldier?.status === "Dead";
  }

  private handleRecruit() {
    if (this.onRecruit) this.onRecruit("");
  }

  private handleRevive() {
    if (this.onRevive) this.onRevive("");
  }

  public renderDetails(): HTMLElement | DocumentFragment {
    if (!this.soldier) {
      return this.renderEmptyDetails();
    }

    const sStats = this.calculateSoldierStats(this.soldier);
    const equip = this.getEquipment(this.soldier);
    const rw = this.getWeaponStats(equip.rightHand, sStats.speed);
    const lw = this.getWeaponStats(equip.leftHand, sStats.speed);

    const state = this.isCampaign ? this.manager.getState() : null;
    const rosterSoldier = this.isCampaign && "id" in this.soldier && this.soldier.id
      ? state?.roster.find((s) => s.id === (this.soldier as CampaignSoldier).id)
      : null;

    return (
      <div class="inspector-details-content flex-col align-center gap-20">
        {this.isDead() && (
          <div class="w-full dead-warning">
            {t(I18nKeys.screen.inspector.integrity_failure)}
          </div>
        )}
        {this.isLocked && (
          <div class="w-full dead-warning">
            {t(I18nKeys.screen.inspector.terminal_offline)}
          </div>
        )}

        {rosterSoldier && this.renderRosterSoldierInfo(rosterSoldier, state)}

        <div class="w-full stat-box soldier-attributes-panel">
          <h3 class="stat-label inspector-panel-title">{t(I18nKeys.screen.inspector.integrity_profile)}</h3>
          <div class="flex-row gap-20 inspector-stats-grid">
            <StatDisplayComponent icon={Icons.Health} value={sStats.hp} title={t(I18nKeys.screen.inspector.max_integrity)} iconSize="14px" />
            <StatDisplayComponent icon={Icons.Speed} value={sStats.speed} title={t(I18nKeys.hud.stat.speed)} iconSize="14px" />
            <StatDisplayComponent icon={Icons.Accuracy} value={sStats.accuracy} title={t(I18nKeys.screen.inspector.targeting_efficiency)} iconSize="14px" />
          </div>
        </div>

        <div class="w-full stat-box weapon-performance-panel">
          <h3 class="stat-label inspector-panel-title-alt">{t(I18nKeys.screen.inspector.equipment_performance)}</h3>
          <div class="w-full">
            <WeaponBlock stats={rw} label={t(I18nKeys.screen.inspector.primary_rh)} />
            <WeaponBlock stats={lw} label={t(I18nKeys.screen.inspector.secondary_lh)} />
          </div>
        </div>

        <div class="inspector-slots-grid">
          {this.createSlotComponent(t(I18nKeys.screen.inspector.primary_rh), equip.rightHand, (id) => this.handleSlotChange("rightHand", id), false)}
          {this.createSlotComponent(t(I18nKeys.screen.inspector.secondary_lh), equip.leftHand, (id) => this.handleSlotChange("leftHand", id), false)}
          {this.createSlotComponent(t(I18nKeys.screen.inspector.slot_body), equip.body, (id) => this.handleSlotChange("body", id))}
          {this.createSlotComponent(t(I18nKeys.screen.inspector.slot_feet), equip.feet, (id) => this.handleSlotChange("feet", id))}
        </div>
      </div>
    ) as HTMLElement;
  }

  private renderEmptyDetails(): HTMLElement {
    const state = this.isCampaign ? this.manager.getState() : null;
    return (
      <div class="inspector-empty-wrapper flex-col gap-20 align-center h-full">
        <div class="inspector-placeholder flex-col align-center justify-center">
          <div class="placeholder-icon">👤</div>
          <div>{t(I18nKeys.screen.inspector.select_slot_msg)}</div>
        </div>
        {state && !this.isLocked && (
          <div class="inspector-recruit-options flex-col gap-10 w-full">
            {state.roster.length < CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE && (
              <button
                class="menu-button w-full recruit-btn-large"
                data-focus-id="recruit-btn-large"
                onClick={() => this.handleRecruit()}
              >
                <div class="btn-label">{t(I18nKeys.screen.equipment.acquire_new)}</div>
                <div class="btn-sub">{t(I18nKeys.common.cost_credits, { cost: 100 })}</div>
              </button>
            )}
            <button
              class={`menu-button w-full revive-btn-large ${state.scrap < 250 ? "disabled" : ""}`}
              data-focus-id="revive-btn-large"
              disabled={state.scrap < 250}
              onClick={() => this.handleRevive()}
            >
              <div class="btn-label">{t(I18nKeys.screen.equipment.restore_lost)}</div>
              <div class="btn-sub">{t(I18nKeys.common.cost_credits, { cost: 250 })}</div>
            </button>
          </div>
        )}
      </div>
    ) as HTMLElement;
  }

  private renderRosterSoldierInfo(
    rosterSoldier: CampaignSoldier,
    state: ReturnType<typeof this.manager.getState>,
  ): HTMLElement | DocumentFragment {
    return (
      <Fragment>
        <div class="flex-row justify-between align-center w-full p-10 card" style={{ background: "var(--color-surface-elevated)" }}>
          <div class="flex-row align-center gap-10">
            <div class="flex-col">
              <h3 style={{ margin: "0", fontSize: "1.2em", color: "var(--color-accent)" }}>{rosterSoldier.name}</h3>
              <div style={{ fontSize: "0.8em", color: "var(--color-text-muted)" }}>
                {t(I18nKeys.units.lvl, { level: rosterSoldier.level })} {t("units.archetype." + rosterSoldier.archetypeId)}
              </div>
            </div>
            <button
              class="icon-button"
              title={t(I18nKeys.screen.inspector.rename_asset)}
              style={{ padding: "4px 8px", fontSize: "1em", margin: "0" }}
              onClick={() => {
                void (async () => {
                  const newName = await this.modalService.prompt(
                    t(I18nKeys.screen.inspector.rename_prompt),
                    rosterSoldier.name,
                    t(I18nKeys.screen.inspector.rename_asset),
                  );
                  if (newName && newName.trim() !== "" && newName !== rosterSoldier.name) {
                    this.manager.renameSoldier(rosterSoldier.id, newName.trim());
                    this.onUpdate();
                  }
                })();
              }}
            >
              ✎
            </button>
          </div>
          <div
            class="status-badge"
            style={{
              fontSize: "0.7em",
              padding: "2px 6px",
              borderRadius: "4px",
              background: rosterSoldier.status === "Healthy" ? "var(--color-primary)" : (rosterSoldier.status === "Dead" ? "var(--color-danger)" : "var(--color-hive)")
            }}
          >
            {this.getStatusDisplay(rosterSoldier.status)}
          </div>
        </div>

        {rosterSoldier.status === "Wounded" && (
          <div class="flex-row gap-10 w-full">
            <button
              class="menu-button w-full"
              disabled={!state || state.scrap < 50}
              onClick={() => {
                this.manager.healSoldier(rosterSoldier.id, 50);
                this.onUpdate();
              }}
            >
              <div class="btn-label">{t(I18nKeys.screen.inspector.restore_integrity)}</div>
              <div class="btn-sub">{t(I18nKeys.common.cost_credits, { cost: 50 })}</div>
            </button>
          </div>
        )}
      </Fragment>
    ) as HTMLElement | DocumentFragment;
  }

  public renderArmory(): HTMLElement | DocumentFragment {
    if (!this.soldier) return <Fragment />;
    const soldier = this.soldier;

    const state = this.isCampaign ? this.manager.getState() : null;
    const unlockedItems = state?.unlockedItems ?? [];
    const basicItems = [
      "pistol", "pulse_rifle", "shotgun", "combat_knife", "power_sword", 
      "thunder_hammer", "medkit", "frag_grenade", "combat_boots", "light_recon"
    ];

    const isUnlocked = (id: string) => basicItems.includes(id) || unlockedItems.includes(id);

    const categories = [
      {
        title: t(I18nKeys.screen.inspector.primary_weapons),
        items: Object.values(WeaponLibrary).filter((w) => w.type === "Ranged" && isUnlocked(w.id)),
        slot: "rightHand" as keyof EquipmentState,
        onSelect: (w: Weapon | Item) => this.handleSlotChange("rightHand", w.id)
      },
      {
        title: t(I18nKeys.screen.inspector.secondary_weapons),
        items: Object.values(WeaponLibrary).filter((w) => w.type === "Melee" && isUnlocked(w.id)),
        slot: "leftHand" as keyof EquipmentState,
        onSelect: (w: Weapon | Item) => this.handleSlotChange("leftHand", w.id)
      },
      {
        title: t(I18nKeys.screen.inspector.armor),
        items: Object.values(ItemLibrary).filter((i) => (i.id.includes("recon") || i.id.includes("plate")) && isUnlocked(i.id)),
        slot: "body" as keyof EquipmentState,
        onSelect: (i: Weapon | Item) => this.handleSlotChange("body", i.id)
      },
      {
        title: t(I18nKeys.screen.inspector.footwear),
        items: Object.values(ItemLibrary).filter((i) => i.id.includes("boots") && isUnlocked(i.id)),
        slot: "feet" as keyof EquipmentState,
        onSelect: (i: Weapon | Item) => this.handleSlotChange("feet", i.id)
      }
    ];

    return (
      <Fragment>
        {categories.map((cat) => (
          <Fragment>
            <h3 class="armory-category-title">{cat.title}</h3>
            {cat.items.map((item) => (
              <ArmoryItem
                item={item}
                state={state}
                isShop={this.isShop}
                isLocked={this.isLocked}
                isDead={this.isDead()}
                isCurrentlyEquipped={this.getEquipment(soldier).rightHand === item.id || this.getEquipment(soldier).leftHand === item.id || this.getEquipment(soldier).body === item.id || this.getEquipment(soldier).feet === item.id}
                isOwned={this.isEquippedInRoster(soldier.id, cat.slot, item.id)}
                onSelect={() => cat.onSelect(item)}
              />
            ))}
          </Fragment>
        ))}
      </Fragment>
    ) as HTMLElement;
  }

  private createSlotComponent(
    label: string,
    itemId: string | undefined,
    onDrop: (id: string) => void,
    allowRemove: boolean = true,
  ) {
    const isDead = this.isDead();
    const item = itemId ? (WeaponLibrary[itemId] || ItemLibrary[itemId]) : null;

    return (
      <div
        class={`paper-doll-slot ${itemId ? "equipped" : ""} ${(isDead || this.isLocked) ? "disabled" : ""}`}
        tabindex="0"
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            if (!isDead && !this.isLocked && itemId && allowRemove) {
              onDrop("");
            }
            e.preventDefault();
          }
        }}
      >
        <div class="slot-title">{label}</div>
        {item ? (
          <Fragment>
            <div class="slot-item-name">{t("units.item." + item.id)}</div>
            {allowRemove && (
              <div
                class="slot-remove-btn"
                onClick={(e: Event) => {
                  e.stopPropagation();
                  if (!isDead && !this.isLocked) onDrop("");
                }}
              >
                ×
              </div>
            )}
          </Fragment>
        ) : (
          <div class="slot-empty-plus">+</div>
        )}
      </div>
    );
  }

  private calculateSoldierStats(soldier: CampaignSoldier | SquadSoldierConfig) {
    const arch = ArchetypeLibrary[soldier.archetypeId];
    if (!arch) return { hp: 0, speed: 0, accuracy: 0 };

    let hp: number = arch.baseHp;
    let speed: number = arch.speed;
    let accuracy: number = arch.soldierAim;

    if ("id" in soldier && soldier.id && this.isCampaign) {
      const state = this.manager.getState();
      const rosterSoldier = state?.roster.find((s) => s.id === soldier.id);
      if (rosterSoldier) {
        hp = rosterSoldier.maxHp;
        speed = arch.speed;
        accuracy = rosterSoldier.soldierAim;
      }
    } else {
      if ("maxHp" in soldier && soldier.maxHp !== undefined) hp = soldier.maxHp;
      if ("soldierAim" in soldier && soldier.soldierAim !== undefined)
        accuracy = soldier.soldierAim;
    }

    const equip = this.getEquipment(soldier);
    const slots = [equip.body, equip.feet, equip.rightHand, equip.leftHand];
    slots.forEach((id) => {
      if (!id) return;
      const item = ItemLibrary[id];
      if (item) {
        if (item.hpBonus) hp += item.hpBonus;
        if (item.speedBonus) speed += item.speedBonus;
        if (item.accuracyBonus) accuracy += item.accuracyBonus;
      }
    });

    return { hp, speed, accuracy };
  }

  private getWeaponStats(weaponId?: string, soldierSpeed: number = 20) {
    if (!weaponId) return null;
    const weapon = WeaponLibrary[weaponId];
    if (!weapon) return null;

    const scaledFireRate =
      weapon.fireRate * (soldierSpeed > 0 ? SPEED_NORMALIZATION_CONST / soldierSpeed : 1);
    const fireRateVal =
      scaledFireRate > 0 ? (1000 / scaledFireRate).toFixed(1) : "0";

    return {
      name: weapon.name,
      damage: weapon.damage,
      range: weapon.range,
      fireRate: fireRateVal,
      accuracy: weapon.accuracy,
    };
  }

  private getEquipment(
    soldier: CampaignSoldier | SquadSoldierConfig,
  ): EquipmentState {
    if ("equipment" in soldier) {
      return (soldier).equipment;
    }
    return {
      rightHand: (soldier).rightHand,
      leftHand: (soldier).leftHand,
      body: (soldier).body,
      feet: (soldier).feet,
    };
  }

  private isEquippedInRoster(
    soldierId: string | undefined,
    slot: keyof EquipmentState,
    itemId: string,
  ): boolean {
    if (!soldierId || !this.isCampaign) return false;
    const state = this.isCampaign ? this.manager.getState() : null;
    if (!state) return false;
    const soldier = state.roster.find((s) => s.id === soldierId);
    if (!soldier) return false;
    return soldier.equipment[slot] === itemId;
  }

  private getStatusDisplay(status: string): string {
    if (status === "Healthy") return t(I18nKeys.units.status.functional);
    if (status === "Wounded") return t(I18nKeys.units.status.damaged);
    if (status === "Dead") return t(I18nKeys.units.status.integrity_failure);
    if (status === "Extracted") return t(I18nKeys.units.status.retrieved);
    return String(status);
  }

  private tryPurchaseItem(newItemId: string): boolean {
    const state = this.isCampaign ? this.manager.getState() : null;
    const economyMode = state?.rules?.economyMode || "Open";
    if (economyMode === "Limited" && !this.isShop) return false;

    const item = WeaponLibrary[newItemId] || ItemLibrary[newItemId];
    if (!item) return true;

    let cost = item.cost;
    if (this.isShop && economyMode === "Open") cost = Math.floor(cost * 0.5);
    if (state && state.scrap < cost) return false;
    if (state) this.manager.spendScrap(cost);
    return true;
  }

  private assignSlot(slot: keyof EquipmentState, newItemId: string) {
    if (!this.soldier) return;
    if ("equipment" in this.soldier) {
      this.soldier.equipment[slot] = newItemId || undefined;
      this.manager.assignEquipment(this.soldier.id, this.soldier.equipment);
      return;
    }
    const config = this.soldier;
    config[slot] = newItemId || undefined;
    if (this.soldier.id && this.isCampaign) {
      const state = this.manager.getState();
      const rosterSoldier = state?.roster.find((s) => s.id === this.soldier?.id);
      if (rosterSoldier) {
        const newEquip = { ...rosterSoldier.equipment };
        newEquip[slot] = newItemId || undefined;
        this.manager.assignEquipment(this.soldier.id, newEquip);
      }
    }
  }

  private handleSlotChange(slot: keyof EquipmentState, newItemId: string) {
    if (!this.soldier) return;
    if (this.isDead()) return;

    const equip = this.getEquipment(this.soldier);
    if (equip[slot] === newItemId) return;

    const isOwned = this.isEquippedInRoster(this.soldier.id, slot, newItemId);
    if (newItemId !== "" && !isOwned) {
      if (!this.tryPurchaseItem(newItemId)) return;
    }

    this.assignSlot(slot, newItemId);
    this.onUpdate();
  }
}

function WeaponBlock({ stats, label }: { stats: WeaponStats | null; label: string }) {
  if (!stats) return <div class="weapon-block-empty">{label}: [{t(I18nKeys.units.empty_weapon)}]</div>;
  return (
    <div class="weapon-block">
      <div class="weapon-block-title">{label}: {stats.name}</div>
      <div class="weapon-block-stats">
        <StatDisplayComponent icon={Icons.Damage} value={stats.damage} title={t(I18nKeys.screen.inspector.damage_per_hit)} />
        <StatDisplayComponent icon={Icons.Rate} value={stats.fireRate} title={t(I18nKeys.hud.stat.rate)} />
        <StatDisplayComponent icon={Icons.Range} value={stats.range} title={t(I18nKeys.hud.stat.range)} />
        <StatDisplayComponent icon={Icons.Accuracy} value={(stats.accuracy >= 0 ? "+" : "") + stats.accuracy} title={t(I18nKeys.screen.inspector.weapon_accuracy_mod)} />
      </div>
    </div>
  );
}

function buildWeaponStats(item: Weapon): { html: HTMLElement | DocumentFragment; text: string } {
  const fireRateVal = item.fireRate || 0;
  const fireRateStr = fireRateVal > 0 ? (1000 / fireRateVal).toFixed(1) : "0";
  const acc = item.accuracy || 0;
  return {
    html: (
      <Fragment>
        <StatDisplayComponent icon={Icons.Damage} value={item.damage || 0} title={t(I18nKeys.hud.stat.damage)} />
        <StatDisplayComponent icon={Icons.Rate} value={fireRateStr} title={t(I18nKeys.hud.stat.rate)} />
        <StatDisplayComponent icon={Icons.Range} value={item.range || 0} title={t(I18nKeys.hud.stat.range)} />
      </Fragment>
    ) as unknown as DocumentFragment,
    text: `${t(I18nKeys.hud.stat.damage)}: ${item.damage}\n${t(I18nKeys.hud.stat.range)}: ${item.range}\n${t(I18nKeys.hud.stat.rate)}: ${fireRateStr}/s\n${t(I18nKeys.hud.stat.accuracy)}: ${acc > 0 ? "+" : ""}${acc}%`,
  };
}

function buildItemStats(item: Item): { html: HTMLElement | DocumentFragment; text: string } {
  const bonuses: (HTMLElement | DocumentFragment)[] = [];
  const textBonuses: string[] = [];
  if (item.hpBonus) {
    bonuses.push(<StatDisplayComponent icon={Icons.Health} value={item.hpBonus} title={t(I18nKeys.screen.inspector.max_integrity)} /> as HTMLElement);
    textBonuses.push(`${t(I18nKeys.screen.inspector.max_integrity)}: ${item.hpBonus > 0 ? "+" : ""}${item.hpBonus}`);
  }
  if (item.speedBonus) {
    bonuses.push(<StatDisplayComponent icon={Icons.Speed} value={item.speedBonus} title={t(I18nKeys.hud.stat.speed)} /> as HTMLElement);
    textBonuses.push(`${t(I18nKeys.hud.stat.speed)}: ${item.speedBonus > 0 ? "+" : ""}${item.speedBonus}`);
  }
  if (item.accuracyBonus) {
    bonuses.push(<StatDisplayComponent icon={Icons.Accuracy} value={item.accuracyBonus} title={t(I18nKeys.hud.stat.accuracy)} /> as HTMLElement);
    textBonuses.push(`${t(I18nKeys.hud.stat.accuracy)}: ${item.accuracyBonus > 0 ? "+" : ""}${item.accuracyBonus}%`);
  }
  return {
    html: (<Fragment>{...bonuses}</Fragment>) as unknown as DocumentFragment,
    text: textBonuses.join("\n"),
  };
}

interface ArmoryItemProps {
  item: Weapon | Item;
  state: CampaignState | null;
  isShop: boolean;
  isLocked: boolean;
  isDead: boolean;
  isCurrentlyEquipped: boolean;
  isOwned: boolean;
  onSelect: () => void;
}

function calcArmoryItemCost(item: Weapon | Item, isShop: boolean, economyMode: string): number {
  if (isShop && economyMode === "Open") return Math.floor(item.cost * 0.5);
  return item.cost;
}

function isArmoryItemDisabled(params: {
  isDead: boolean;
  isLocked: boolean;
  isCurrentlyEquipped: boolean;
  isOwned: boolean;
  canAfford: boolean;
}): boolean {
  const { isDead, isLocked, isCurrentlyEquipped, isOwned, canAfford } = params;
  return isDead || isLocked || (!isCurrentlyEquipped && !isOwned && !canAfford);
}

function ArmoryItem({
  item, state, isShop, isLocked, isDead, isCurrentlyEquipped, isOwned, onSelect
}: ArmoryItemProps) {
  const economyMode = state?.rules?.economyMode || "Open";
  if (economyMode === "Limited" && !isShop && !isOwned && !isCurrentlyEquipped) return null;

  const cost = calcArmoryItemCost(item, isShop, economyMode);
  const canAfford = !state || state.scrap >= cost;
  const isDisabled = isArmoryItemDisabled({ isDead, isLocked, isCurrentlyEquipped, isOwned, canAfford });

  const { html: statsHtml, text: fullStats } = "damage" in item
    ? buildWeaponStats(item as Weapon)
    : buildItemStats(item);

  const priceText = isOwned || isCurrentlyEquipped ? t(I18nKeys.screen.inspector.owned) : t(I18nKeys.common.cost_credits, { cost });
  const priceClass = isOwned || isCurrentlyEquipped ? "price-owned" : "price-cost";

  return (
    <div
      class={`menu-item clickable armory-item ${isCurrentlyEquipped ? "active" : ""} ${isDisabled ? "disabled" : ""}`}
      title={`${t("units.item." + item.id)}\n${t("units.item.desc." + item.id) || ""}${fullStats ? `\n\n${  fullStats}` : ""}`}
      data-focus-id={`armory-item-${item.id}`}
      tabindex="0"
      onClick={() => !isDisabled && onSelect()}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          if (!isDisabled) onSelect();
          e.preventDefault();
        }
      }}
    >
      <div class="armory-item-content" style={{ width: "100%" }}>
        <div class="armory-item-header" style={{ width: "100%", display: "flex", justifyContent: "space-between" }}>
          <span>{t("units.item." + item.id)}</span>
          <span class={priceClass}>{priceText}</span>
        </div>
        <div class="armory-item-stats">
          {statsHtml}
        </div>
      </div>
    </div>
  );
}
