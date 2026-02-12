import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { CampaignSoldier } from "@src/shared/campaign_types";
import {
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
  Item,
  Weapon,
  EquipmentState,
  SquadSoldierConfig,
} from "@src/shared/types";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";

export interface SoldierInspectorOptions {
  manager: CampaignManager;
  onUpdate: () => void;
  onRecruit?: (soldierId: string) => void;
  onRevive?: (soldierId: string) => void;
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

  private soldier: CampaignSoldier | SquadSoldierConfig | null = null;
  private isShop: boolean = false;
  private isCampaign: boolean = false;

  constructor(options: SoldierInspectorOptions) {
    this.manager = options.manager;
    this.onUpdate = options.onUpdate;
    this.onRecruit = options.onRecruit;
    this.onRevive = options.onRevive;
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

  private isDead(): boolean {
    if (!this.soldier || !("id" in this.soldier) || !this.soldier.id || !this.isCampaign)
      return false;
    const state = this.manager.getState();
    const rosterSoldier = state?.roster.find((s) => s.id === this.soldier!.id);
    return rosterSoldier?.status === "Dead";
  }

  private handleRecruit() {
    if (this.onRecruit) this.onRecruit("");
  }

  private handleRevive() {
    if (this.onRevive) this.onRevive("");
  }

  public renderDetails(container: HTMLElement) {
    container.innerHTML = "";
    if (!this.soldier) {
      const wrapper = document.createElement("div");
      wrapper.className =
        "inspector-empty-wrapper flex-col gap-20 align-center h-full";

      const placeholder = document.createElement("div");
      placeholder.className =
        "inspector-placeholder flex-col align-center justify-center";
      placeholder.innerHTML = `
        <div class="placeholder-icon">👤</div>
        <div>Select a Slot to Manage Squad</div>
      `;
      wrapper.appendChild(placeholder);

      // Recruit/Revive Options (Campaign only)
      const state = this.isCampaign ? this.manager.getState() : null;
      if (state) {
        const optionsDiv = document.createElement("div");
        optionsDiv.className =
          "inspector-recruit-options flex-col gap-10 w-full";

        if (state.roster.length < CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE) {
          const recruitBtn = document.createElement("button");
          recruitBtn.className = "menu-button w-full recruit-btn-large";
          recruitBtn.setAttribute("data-focus-id", "recruit-btn-large");
          recruitBtn.innerHTML = `
          <div class="btn-label">Recruit New Soldier</div>
          <div class="btn-sub">Cost: 100 Scrap</div>
        `;
          recruitBtn.onclick = () => this.handleRecruit();
          optionsDiv.appendChild(recruitBtn);
        }

        const reviveBtn = document.createElement("button");
        const canAffordRevive = state.scrap >= 250;
        reviveBtn.className = `menu-button w-full revive-btn-large ${!canAffordRevive ? "disabled" : ""}`;
        reviveBtn.setAttribute("data-focus-id", "revive-btn-large");
        reviveBtn.disabled = !canAffordRevive;
        reviveBtn.innerHTML = `
        <div class="btn-label">Revive Fallen Soldier</div>
        <div class="btn-sub">Cost: 250 Scrap</div>
      `;
        reviveBtn.onclick = () => this.handleRevive();
        optionsDiv.appendChild(reviveBtn);

        wrapper.appendChild(optionsDiv);
      }
      container.appendChild(wrapper);
      return;
    }

    const content = document.createElement("div");
    content.className =
      "inspector-details-content flex-col align-center gap-20";

    const sStats = this.calculateSoldierStats(this.soldier);

    // Dead Warning
    if (this.isDead()) {
      const deadDiv = document.createElement("div");
      deadDiv.className = "w-full dead-warning";
      deadDiv.textContent = "Soldier is Deceased - Equipment Locked";
      content.appendChild(deadDiv);
    }

    // Soldier Stats Panel
    const soldierStatsDiv = document.createElement("div");
    soldierStatsDiv.className = "w-full stat-box soldier-attributes-panel";

    const h3Soldier = document.createElement("h3");
    h3Soldier.textContent = "Soldier Attributes";
    h3Soldier.className = "stat-label inspector-panel-title";
    soldierStatsDiv.appendChild(h3Soldier);

    const sGrid = document.createElement("div");
    sGrid.className = "flex-row gap-20 inspector-stats-grid";
    sGrid.innerHTML = `
      ${StatDisplay.render(Icons.Health, sStats.hp, "Max Health", { iconSize: "14px" })}
      ${StatDisplay.render(Icons.Speed, sStats.speed, "Movement Speed", { iconSize: "14px" })}
      ${StatDisplay.render(Icons.Accuracy, sStats.accuracy, "Base Accuracy (Aim)", { iconSize: "14px" })}
    `;
    soldierStatsDiv.appendChild(sGrid);
    content.appendChild(soldierStatsDiv);

    // Weapon Stats Panel
    const weaponStatsDiv = document.createElement("div");
    weaponStatsDiv.className = "w-full stat-box weapon-performance-panel";

    const h3Weapon = document.createElement("h3");
    h3Weapon.textContent = "Equipment Performance";
    h3Weapon.className = "stat-label inspector-panel-title-alt";
    weaponStatsDiv.appendChild(h3Weapon);

    const equip = this.getEquipment(this.soldier);
    const rw = this.getWeaponStats(equip.rightHand, sStats.speed);
    const lw = this.getWeaponStats(equip.leftHand, sStats.speed);

    const renderWepBlock = (w: WeaponStats | null, label: string) => {
      if (!w)
        return `<div class="weapon-block-empty">${label}: [No Equipment]</div>`;
      return `
            <div class="weapon-block">
                <div class="weapon-block-title">${label}: ${w.name}</div>
                <div class="weapon-block-stats">
                    ${StatDisplay.render(Icons.Damage, w.damage, "Damage per hit")}
                    ${StatDisplay.render(Icons.Rate, w.fireRate, "Rounds per second")}
                    ${StatDisplay.render(Icons.Range, w.range, "Effective Range (m)")}
                    ${StatDisplay.render(Icons.Accuracy, (w.accuracy >= 0 ? "+" : "") + w.accuracy, "Weapon Accuracy Modifier")}
                </div>
            </div>
        `;
    };

    const wContent = document.createElement("div");
    wContent.className = "w-full";
    wContent.innerHTML =
      renderWepBlock(rw, "Primary (RH)") + renderWepBlock(lw, "Secondary (LH)");
    weaponStatsDiv.appendChild(wContent);
    content.appendChild(weaponStatsDiv);

    // Slots
    const slotsGrid = document.createElement("div");
    slotsGrid.className = "inspector-slots-grid";

    slotsGrid.appendChild(
      this.createSlot("Right Hand", equip.rightHand, (id) =>
        this.handleSlotChange("rightHand", id),
      ),
    );

    slotsGrid.appendChild(
      this.createSlot("Left Hand", equip.leftHand, (id) =>
        this.handleSlotChange("leftHand", id),
      ),
    );

    slotsGrid.appendChild(
      this.createSlot("Body", equip.body, (id) =>
        this.handleSlotChange("body", id),
      ),
    );

    slotsGrid.appendChild(
      this.createSlot("Feet", equip.feet, (id) =>
        this.handleSlotChange("feet", id),
      ),
    );

    content.appendChild(slotsGrid);
    container.appendChild(content);
  }

  public renderArmory(container: HTMLElement) {
    container.innerHTML = "";
    if (!this.soldier) return;

    const state = this.isCampaign ? this.manager.getState() : null;
    const unlockedItems = state?.unlockedItems || [];
    const basicItems = [
      "pistol",
      "pulse_rifle",
      "shotgun",
      "combat_knife",
      "power_sword",
      "thunder_hammer",
      "medkit",
      "frag_grenade",
      "combat_boots",
      "light_recon",
    ];

    const isUnlocked = (id: string) =>
      basicItems.includes(id) || unlockedItems.includes(id);

    // Primary Weapons
    this.renderArmoryCategory(
      container,
      "Primary Weapons",
      Object.values(WeaponLibrary).filter(
        (w) => w.type === "Ranged" && isUnlocked(w.id),
      ),
      (w) => this.handleSlotChange("rightHand", w.id),
      "rightHand",
    );

    // Secondary Weapons
    this.renderArmoryCategory(
      container,
      "Secondary Weapons",
      Object.values(WeaponLibrary).filter(
        (w) => w.type === "Melee" && isUnlocked(w.id),
      ),
      (w) => this.handleSlotChange("leftHand", w.id),
      "leftHand",
    );

    // Armor
    this.renderArmoryCategory(
      container,
      "Armor",
      Object.values(ItemLibrary).filter(
        (i) =>
          (i.id.includes("recon") || i.id.includes("plate")) &&
          isUnlocked(i.id),
      ),
      (i) => this.handleSlotChange("body", i.id),
      "body",
    );

    // Footwear
    this.renderArmoryCategory(
      container,
      "Footwear",
      Object.values(ItemLibrary).filter(
        (i) => i.id.includes("boots") && isUnlocked(i.id),
      ),
      (i) => this.handleSlotChange("feet", i.id),
      "feet",
    );
  }

  private createSlot(
    label: string,
    itemId: string | undefined,
    onDrop: (id: string) => void,
  ): HTMLElement {
    const slot = document.createElement("div");
    slot.className = "paper-doll-slot" + (itemId ? " equipped" : "");
    slot.tabIndex = 0;

    // Disable interactions for dead soldiers
    const isDead = this.isDead();
    if (isDead) {
      slot.classList.add("disabled");
    }

    const title = document.createElement("div");
    title.textContent = label;
    title.className = "slot-title";
    slot.appendChild(title);

    if (itemId) {
      const item = WeaponLibrary[itemId] || ItemLibrary[itemId];
      if (item) {
        const name = document.createElement("div");
        name.textContent = item.name;
        name.className = "slot-item-name";
        slot.appendChild(name);

        const removeBtn = document.createElement("div");
        removeBtn.textContent = "×";
        removeBtn.className = "slot-remove-btn";
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          onDrop("");
        };
        slot.appendChild(removeBtn);
      }
    } else {
      const plus = document.createElement("div");
      plus.textContent = "+";
      plus.className = "slot-empty-plus";
      slot.appendChild(plus);
    }

    slot.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        if (!isDead && itemId) {
          onDrop("");
        }
        e.preventDefault();
      }
    };

    return slot;
  }

  private renderArmoryCategory(
    panel: HTMLElement,
    title: string,
    items: (Weapon | Item)[],
    onSelect: (item: Weapon | Item) => void,
    slot: keyof EquipmentState,
  ) {
    const h3 = document.createElement("h3");
    h3.textContent = title;
    h3.className = "armory-category-title";
    panel.appendChild(h3);

    const state = this.isCampaign ? this.manager.getState() : null;
    const equip = this.getEquipment(this.soldier!);
    const isDead = this.isDead();

    items.forEach((item) => {
      const isCurrentlyEquipped = equip[slot] === item.id;
      const isOwned = this.isEquippedInRoster(this.soldier!.id, slot, item.id);

      const economyMode = state?.rules?.economyMode || "Open";

      // Limited Mode: Hide unowned items in EquipmentScreen
      if (
        economyMode === "Limited" &&
        !this.isShop &&
        !isOwned &&
        !isCurrentlyEquipped
      ) {
        return;
      }

      let cost = item.cost;
      if (this.isShop && economyMode === "Open") {
        cost = Math.floor(cost * 0.5);
      }

      const canAfford = !state || state.scrap >= cost;

      const btn = document.createElement("div");
      btn.className = `menu-item clickable armory-item ${isCurrentlyEquipped ? "active" : ""}`;

      // Disable for dead soldiers OR if cannot afford
      if (isDead || (!isCurrentlyEquipped && !isOwned && !canAfford)) {
        btn.classList.add("disabled");
      }

      let statsHtml = "";
      let fullStats = "";
      if ("damage" in item) {
        const fireRateVal = item.fireRate || 0;
        const fireRateStr =
          fireRateVal > 0 ? (1000 / fireRateVal).toFixed(1) : "0";
        statsHtml = `
          ${StatDisplay.render(Icons.Damage, item.damage || 0, "Damage")}
          ${StatDisplay.render(Icons.Rate, fireRateStr, "Fire Rate")}
          ${StatDisplay.render(Icons.Range, item.range || 0, "Range")}
        `;
        const acc = item.accuracy || 0;
        fullStats = `Damage: ${item.damage}\nRange: ${item.range}\nFire Rate: ${item.fireRate}ms\nAccuracy: ${acc > 0 ? "+" : ""}${acc}%`;
      } else {
        const bonuses = [];
        if (item.hpBonus)
          bonuses.push(StatDisplay.render(Icons.Health, item.hpBonus, "HP"));
        if (item.speedBonus)
          bonuses.push(
            StatDisplay.render(Icons.Speed, item.speedBonus, "Speed"),
          );
        if (item.accuracyBonus)
          bonuses.push(
            StatDisplay.render(Icons.Accuracy, item.accuracyBonus, "Accuracy"),
          );
        statsHtml = bonuses.join(" ");

        const fullBonuses = [];
        if (item.hpBonus)
          fullBonuses.push(`HP: ${item.hpBonus > 0 ? "+" : ""}${item.hpBonus}`);
        if (item.speedBonus)
          fullBonuses.push(
            `Speed: ${item.speedBonus > 0 ? "+" : ""}${item.speedBonus}`,
          );
        if (item.accuracyBonus)
          fullBonuses.push(
            `Accuracy: ${item.accuracyBonus > 0 ? "+" : ""}${item.accuracyBonus}%`,
          );
        fullStats = fullBonuses.join("\n");
      }

      btn.title = `${item.name}\n${item.description || ""}${fullStats ? "\n\n" + fullStats : ""}`;

      const priceText = isOwned || isCurrentlyEquipped ? "Owned" : `${cost} Scrap`;
      const priceClass =
        isOwned || isCurrentlyEquipped ? "price-owned" : "price-cost";

      btn.innerHTML = `
            <div class="armory-item-content" style="width: 100%;">
                <div class="armory-item-header" style="width: 100%; display: flex; justify-content: space-between;">
                    <span>${item.name}</span>
                    <span class="${priceClass}">${priceText}</span>
                </div>
                <div class="armory-item-stats">
                    ${statsHtml}
                </div>
            </div>
        `;
      btn.tabIndex = 0;
      const handleSelect = () => {
        if (!isDead && !btn.classList.contains("disabled")) onSelect(item);
      };
      btn.onclick = handleSelect;
      btn.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleSelect();
          e.preventDefault();
        }
      };
      panel.appendChild(btn);
    });
  }

  private calculateSoldierStats(soldier: CampaignSoldier | SquadSoldierConfig) {
    const arch = ArchetypeLibrary[soldier.archetypeId];
    if (!arch) return { hp: 0, speed: 0, accuracy: 0 };

    let hp: number = arch.baseHp;
    let speed: number = arch.speed;
    let accuracy: number = arch.soldierAim;

    // Use current soldier values if they exist (for levels/campaign)
    if ("id" in soldier && soldier.id && this.isCampaign) {
      const state = this.manager.getState();
      const rosterSoldier = state?.roster.find((s) => s.id === soldier.id);
      if (rosterSoldier) {
        hp = rosterSoldier.maxHp;
        speed = arch.speed; // Speed is currently not increased by level in CampaignManager, but we follow archetype
        accuracy = rosterSoldier.soldierAim;
      }
    } else {
      // Fallback to config values if provided (e.g. for custom missions)
      if ("maxHp" in soldier && soldier.maxHp !== undefined) hp = soldier.maxHp;
      if ("soldierAim" in soldier && soldier.soldierAim !== undefined)
        accuracy = soldier.soldierAim;
    }

    // Apply equipment bonuses
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
      weapon.fireRate * (soldierSpeed > 0 ? 10 / soldierSpeed : 1);
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
      return (soldier as CampaignSoldier).equipment;
    }
    return {
      rightHand: (soldier as SquadSoldierConfig).rightHand,
      leftHand: (soldier as SquadSoldierConfig).leftHand,
      body: (soldier as SquadSoldierConfig).body,
      feet: (soldier as SquadSoldierConfig).feet,
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

  private handleSlotChange(slot: keyof EquipmentState, newItemId: string) {
    if (!this.soldier) return;

    // Prevent changes for dead soldiers
    if (this.isDead()) return;

    const equip = this.getEquipment(this.soldier);
    if (equip[slot] === newItemId) return;

    // Check if owned (already in roster)
    const isOwned = this.isEquippedInRoster(this.soldier.id, slot, newItemId);

    if (newItemId !== "" && !isOwned) {
      const state = this.isCampaign ? this.manager.getState() : null;
      const economyMode = state?.rules?.economyMode || "Open";

      // Limited mode: cannot buy outside of shop
      if (economyMode === "Limited" && !this.isShop) {
        return;
      }

      const item = WeaponLibrary[newItemId] || ItemLibrary[newItemId];
      if (item) {
        let cost = item.cost;
        if (this.isShop && economyMode === "Open") {
          cost = Math.floor(cost * 0.5);
        }

        if (state && state.scrap < cost) {
          return; // Cannot afford
        }
        if (state) {
          this.manager.spendScrap(cost);
        }
      }
    }

    // Update the soldier object
    if ("equipment" in this.soldier) {
      this.soldier.equipment[slot] = newItemId || undefined;
      this.manager.assignEquipment(this.soldier.id, this.soldier.equipment);
    } else {
      const config = this.soldier as SquadSoldierConfig;
      config[slot] = newItemId || undefined;
      // Persistence: write back to CampaignManager if it's a roster soldier
      if (this.soldier.id && this.isCampaign) {
        const state = this.manager.getState();
        const rosterSoldier = state?.roster.find(
          (s) => s.id === this.soldier!.id,
        );
        if (rosterSoldier) {
          const newEquip = { ...rosterSoldier.equipment };
          newEquip[slot] = newItemId || undefined;
          this.manager.assignEquipment(this.soldier.id, newEquip);
        }
      }
    }

    this.onUpdate();
  }
}
