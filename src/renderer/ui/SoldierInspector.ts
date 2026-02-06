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

  private isDead(): boolean {
    if (!this.soldier || !("id" in this.soldier) || !this.soldier.id)
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
      wrapper.className = "flex-col gap-20 align-center h-full";
      wrapper.style.padding = "20px";

      const placeholder = document.createElement("div");
      placeholder.className = "flex-col align-center justify-center";
      placeholder.style.color = "var(--color-border-strong)";
      placeholder.innerHTML = `
        <div style="font-size:3em; margin-bottom:10px;">👤</div>
        <div>Select a slot to manage squad</div>
      `;
      wrapper.appendChild(placeholder);

      // Recruit/Revive Options
      const optionsDiv = document.createElement("div");
      optionsDiv.className = "flex-col gap-10 w-full";
      optionsDiv.style.maxWidth = "400px";
      optionsDiv.style.marginTop = "20px";

      const state = this.manager.getState();
      const healthyWoundedCount = state ? state.roster.filter(s => s.status !== "Dead").length : 0;

      if (healthyWoundedCount < 4) {
        const recruitBtn = document.createElement("button");
        recruitBtn.className = "menu-button w-full";
        recruitBtn.style.padding = "15px";
        recruitBtn.innerHTML = `
          <div style="font-weight:bold;">Recruit New Soldier</div>
          <div style="font-size:0.8em; color:var(--color-text-dim);">Cost: 100 Scrap</div>
        `;
        recruitBtn.onclick = () => this.handleRecruit();
        optionsDiv.appendChild(recruitBtn);
      }

      const reviveBtn = document.createElement("button");
      const canAffordRevive = state ? state.scrap >= 250 : true;
      reviveBtn.className = `menu-button w-full ${!canAffordRevive ? 'disabled' : ''}`;
      reviveBtn.style.padding = "15px";
      reviveBtn.disabled = !canAffordRevive;
      reviveBtn.innerHTML = `
        <div style="font-weight:bold;">Revive Fallen Soldier</div>
        <div style="font-size:0.8em; color:var(--color-text-dim);">Cost: 250 Scrap</div>
      `;
      reviveBtn.onclick = () => this.handleRevive();
      optionsDiv.appendChild(reviveBtn);

      wrapper.appendChild(optionsDiv);
      container.appendChild(wrapper);
      return;
    }

    const content = document.createElement("div");
    content.className = "flex-col align-center gap-20";
    content.style.marginTop = "10px";

    const sStats = this.calculateSoldierStats(this.soldier);

    // Dead Warning
    if (this.isDead()) {
      const deadDiv = document.createElement("div");
      deadDiv.className = "w-full stat-box";
      deadDiv.style.maxWidth = "400px";
      deadDiv.style.borderRadius = "2px";
      deadDiv.style.border = "1px solid var(--color-danger)";
      deadDiv.style.backgroundColor = "rgba(255,0,0,0.1)";
      deadDiv.style.padding = "12px";
      deadDiv.style.textAlign = "center";
      deadDiv.style.color = "var(--color-danger)";
      deadDiv.style.fontWeight = "bold";
      deadDiv.style.letterSpacing = "1px";
      deadDiv.textContent = "SOLDIER IS DECEASED - EQUIPMENT LOCKED";
      content.appendChild(deadDiv);
    }

    // Soldier Stats Panel
    const soldierStatsDiv = document.createElement("div");
    soldierStatsDiv.className = "w-full stat-box";
    soldierStatsDiv.style.maxWidth = "400px";
    soldierStatsDiv.style.borderRadius = "2px";
    soldierStatsDiv.style.borderLeft = "3px solid var(--color-accent)";
    soldierStatsDiv.style.padding = "12px";

    const h3Soldier = document.createElement("h3");
    h3Soldier.textContent = "Soldier Attributes";
    h3Soldier.className = "stat-label";
    h3Soldier.style.margin = "0 0 12px 0";
    h3Soldier.style.letterSpacing = "1px";
    h3Soldier.style.color = "var(--color-accent)";
    soldierStatsDiv.appendChild(h3Soldier);

    const sGrid = document.createElement("div");
    sGrid.className = "flex-row gap-20";
    sGrid.innerHTML = `
      ${StatDisplay.render(Icons.Health, sStats.hp, "Max Health", { iconSize: "14px" })}
      ${StatDisplay.render(Icons.Speed, sStats.speed, "Movement Speed", { iconSize: "14px" })}
      ${StatDisplay.render(Icons.Accuracy, sStats.accuracy, "Base Accuracy (Aim)", { iconSize: "14px" })}
    `;
    soldierStatsDiv.appendChild(sGrid);
    content.appendChild(soldierStatsDiv);

    // Weapon Stats Panel
    const weaponStatsDiv = document.createElement("div");
    weaponStatsDiv.className = "w-full stat-box";
    weaponStatsDiv.style.maxWidth = "400px";
    weaponStatsDiv.style.borderRadius = "2px";
    weaponStatsDiv.style.borderLeft = "3px solid var(--color-primary)";
    weaponStatsDiv.style.padding = "12px";

    const h3Weapon = document.createElement("h3");
    h3Weapon.textContent = "Equipment Performance";
    h3Weapon.className = "stat-label";
    h3Weapon.style.margin = "0 0 12px 0";
    h3Weapon.style.letterSpacing = "1px";
    h3Weapon.style.color = "var(--color-primary)";
    weaponStatsDiv.appendChild(h3Weapon);

    const equip = this.getEquipment(this.soldier);
    const rw = this.getWeaponStats(equip.rightHand, sStats.speed);
    const lw = this.getWeaponStats(equip.leftHand, sStats.speed);

    const renderWepBlock = (w: WeaponStats | null, label: string) => {
      if (!w)
        return `<div style="color:var(--color-text-dim); font-size:0.75em; margin-bottom:12px; font-style: italic;">${label}: [No Equipment]</div>`;
      return `
            <div style="margin-bottom:16px; border-bottom:1px solid var(--color-surface-elevated); padding-bottom:12px;">
                <div style="font-size:0.85em; font-weight:bold; color:var(--color-primary); margin-bottom:8px; text-transform: uppercase; letter-spacing: 0.5px;">${label}: ${w.name}</div>
                <div style="display:flex; gap:16px; flex-wrap:wrap;">
                    ${StatDisplay.render(Icons.Damage, w.damage, "Damage per hit")}
                    ${StatDisplay.render(Icons.Rate, w.fireRate, "Rounds per second")}
                    ${StatDisplay.render(Icons.Range, w.range, "Effective Range (m)")}
                    ${StatDisplay.render(Icons.Accuracy, (w.accuracy >= 0 ? "+" : "") + w.accuracy, "Weapon Accuracy Modifier")}
                </div>
            </div>
        `;
    };

    const wContent = document.createElement("div");
    wContent.style.width = "100%";
    wContent.innerHTML =
      renderWepBlock(rw, "Primary (RH)") + renderWepBlock(lw, "Secondary (LH)");
    weaponStatsDiv.appendChild(wContent);
    content.appendChild(weaponStatsDiv);

    // Slots
    const slotsGrid = document.createElement("div");
    slotsGrid.style.display = "grid";
    slotsGrid.style.gridTemplateColumns = "110px 110px";
    slotsGrid.style.gridTemplateRows = "110px 110px";
    slotsGrid.style.gap = "15px";
    slotsGrid.style.marginTop = "10px";
    slotsGrid.style.padding = "10px";
    slotsGrid.style.background = "rgba(0,0,0,0.2)";
    slotsGrid.style.borderRadius = "4px";
    slotsGrid.style.border = "1px solid var(--color-border)";

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

    const state = this.manager.getState();
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
          (i.id.includes("recon") || i.id.includes("plate")) && isUnlocked(i.id),
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

    // Disable interactions for dead soldiers
    if (this.isDead()) {
      slot.classList.add("disabled");
      slot.style.opacity = "0.5";
      slot.style.cursor = "not-allowed";
      slot.style.pointerEvents = "none";
    }

    const title = document.createElement("div");
    title.textContent = label;
    title.style.fontSize = "0.65em";
    title.style.color = "var(--color-text-dim)";
    title.style.position = "absolute";
    title.style.top = "5px";
    title.style.textTransform = "uppercase";
    title.style.letterSpacing = "0.5px";
    slot.appendChild(title);

    if (itemId) {
      const item = WeaponLibrary[itemId] || ItemLibrary[itemId];
      if (item) {
        const name = document.createElement("div");
        name.textContent = item.name;
        name.style.fontSize = "0.75em";
        name.style.textAlign = "center";
        name.style.fontWeight = "bold";
        name.style.color = "var(--color-primary)";
        name.style.padding = "0 5px";
        slot.appendChild(name);

        const removeBtn = document.createElement("div");
        removeBtn.textContent = "×";
        removeBtn.style.position = "absolute";
        removeBtn.style.top = "2px";
        removeBtn.style.right = "5px";
        removeBtn.style.color = "var(--color-danger)";
        removeBtn.style.cursor = "pointer";
        removeBtn.style.fontSize = "1.2em";
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          onDrop("");
        };
        slot.appendChild(removeBtn);
      }
    } else {
      const plus = document.createElement("div");
      plus.textContent = "+";
      plus.style.fontSize = "1.5em";
      plus.style.color = "var(--color-border-strong)";
      slot.appendChild(plus);
    }

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
    h3.style.fontSize = "0.9em";
    h3.style.color = "var(--color-primary)";
    h3.style.margin = "20px 0 10px 0";
    h3.style.textTransform = "uppercase";
    h3.style.letterSpacing = "1px";
    h3.style.borderBottom = "1px solid var(--color-border)";
    h3.style.paddingBottom = "5px";
    panel.appendChild(h3);

    const state = this.manager.getState();
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
      btn.className = `menu-item clickable ${isCurrentlyEquipped ? "active" : ""}`;

      // Disable for dead soldiers OR if cannot afford
      if (isDead || (!isCurrentlyEquipped && !isOwned && !canAfford)) {
        btn.classList.add("disabled");
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
        if (isDead) {
          btn.style.cursor = "not-allowed";
        }
      }
      btn.style.padding = "8px 12px";
      btn.style.marginBottom = "4px";
      btn.style.fontSize = "0.85em";

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

      const priceText = isOwned || isCurrentlyEquipped ? "Owned" : `${cost} CR`;
      const priceColor =
        isOwned || isCurrentlyEquipped
          ? "var(--color-primary)"
          : "var(--color-text-muted)";

      btn.innerHTML = `
            <div class="flex-col" style="width: 100%;">
                <div class="flex-row justify-between" style="font-weight:bold; font-size: 0.95em; width: 100%;">
                    <span>${item.name}</span>
                    <span style="color:${priceColor};">${priceText}</span>
                </div>
                <div style="font-size:0.8em; color:var(--color-text-muted); margin-top:4px; display:flex; gap:10px;">
                    ${statsHtml}
                </div>
            </div>
        `;
      btn.onclick = () => {
        if (!isDead) onSelect(item);
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
    if ("id" in soldier && soldier.id) {
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
    if (!soldierId) return false;
    const state = this.manager.getState();
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
      const state = this.manager.getState();
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
      if (this.soldier.id) {
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
