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
}

export class SoldierInspector {
  private manager: CampaignManager;
  private onUpdate: () => void;

  private soldier: CampaignSoldier | SquadSoldierConfig | null = null;
  private isMissionSetup: boolean = false;

  constructor(options: SoldierInspectorOptions) {
    this.manager = options.manager;
    this.onUpdate = options.onUpdate;
  }

  public setSoldier(soldier: CampaignSoldier | SquadSoldierConfig | null, isMissionSetup: boolean) {
    this.soldier = soldier;
    this.isMissionSetup = isMissionSetup;
  }

  public renderDetails(container: HTMLElement) {
    container.innerHTML = "";
    if (!this.soldier) {
      const placeholder = document.createElement("div");
      placeholder.className = "flex-col align-center justify-center h-full";
      placeholder.style.color = "var(--color-border-strong)";
      placeholder.style.minHeight = "300px";
      placeholder.innerHTML = `
        <div style="font-size:3em; margin-bottom:10px;">👤</div>
        <div>Select a soldier to view details</div>
      `;
      container.appendChild(placeholder);
      return;
    }

    const content = document.createElement("div");
    content.className = "flex-col align-center gap-20";
    content.style.marginTop = "10px";

    // Soldier Stats Panel
    const soldierStatsDiv = document.createElement("div");
    soldierStatsDiv.className = "w-full stat-box";
    soldierStatsDiv.style.maxWidth = "400px";
    soldierStatsDiv.style.borderRadius = "4px";

    const h3Soldier = document.createElement("h3");
    h3Soldier.textContent = "SOLDIER ATTRIBUTES";
    h3Soldier.className = "stat-label";
    h3Soldier.style.margin = "0 0 10px 0";
    h3Soldier.style.letterSpacing = "1px";
    soldierStatsDiv.appendChild(h3Soldier);

    const sStats = this.calculateSoldierStats(this.soldier);
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
    weaponStatsDiv.style.borderRadius = "4px";
    weaponStatsDiv.style.borderLeft = "3px solid var(--color-primary)";

    const h3Weapon = document.createElement("h3");
    h3Weapon.textContent = "EQUIPMENT";
    h3Weapon.className = "stat-label";
    h3Weapon.style.margin = "0 0 10px 0";
    h3Weapon.style.letterSpacing = "1px";
    weaponStatsDiv.appendChild(h3Weapon);

    const equip = this.getEquipment(this.soldier);
    const rw = this.getWeaponStats(equip.rightHand, sStats.speed);
    const lw = this.getWeaponStats(equip.leftHand, sStats.speed);

    const renderWepBlock = (w: any, label: string) => {
      if (!w)
        return `<div style="color:var(--color-text-dim); font-size:0.7em; margin-bottom:8px;">${label}: [EMPTY SLOT]</div>`;
      return `
            <div style="margin-bottom:12px; border-bottom:1px solid var(--color-surface-elevated); padding-bottom:8px;">
                <div style="font-size:0.8em; font-weight:bold; color:var(--color-primary); margin-bottom:4px;">${label}: ${w.name}</div>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">

                    ${StatDisplay.render(Icons.Damage, w.damage, "Damage per hit")}
                    ${StatDisplay.render(Icons.Rate, w.fireRate, "Rounds per second")}
                    ${StatDisplay.render(Icons.Range, w.range, "Effective Range (m)")}
                    ${StatDisplay.render(Icons.Accuracy, (w.accuracy >= 0 ? "+" : "") + w.accuracy, "Weapon Accuracy Modifier")}
                </div>
            </div>
        `;
    };

    const wContent = document.createElement("div");
    wContent.innerHTML =
      renderWepBlock(rw, "PRIMARY (RH)") + renderWepBlock(lw, "SECONDARY (LH)");
    weaponStatsDiv.appendChild(wContent);
    content.appendChild(weaponStatsDiv);

    // Slots
    const slotsGrid = document.createElement("div");
    slotsGrid.style.display = "grid";
    slotsGrid.style.gridTemplateColumns = "100px 100px";
    slotsGrid.style.gridTemplateRows = "100px 100px";
    slotsGrid.style.gap = "20px";
    slotsGrid.style.marginTop = "20px";

    slotsGrid.appendChild(
      this.createSlot(
        "Right Hand",
        equip.rightHand,
        (id) => this.handleSlotChange("rightHand", id),
        "Weapon",
      ),
    );

    slotsGrid.appendChild(
      this.createSlot(
        "Left Hand",
        equip.leftHand,
        (id) => this.handleSlotChange("leftHand", id),
        "Weapon",
      ),
    );

    slotsGrid.appendChild(
      this.createSlot(
        "Body",
        equip.body,
        (id) => this.handleSlotChange("body", id),
        "Armor",
      ),
    );

    slotsGrid.appendChild(
      this.createSlot(
        "Feet",
        equip.feet,
        (id) => this.handleSlotChange("feet", id),
        "Feet",
      ),
    );

    content.appendChild(slotsGrid);
    container.appendChild(content);
  }

  public renderArmory(container: HTMLElement) {
    container.innerHTML = "";
    if (!this.soldier) return;

    // Primary Weapons
    this.renderArmoryCategory(
      container,
      "Primary Weapons",
      Object.values(WeaponLibrary).filter((w) => w.type === "Ranged"),
      (w) => this.handleSlotChange("rightHand", w.id),
      "rightHand",
    );

    // Secondary Weapons
    this.renderArmoryCategory(
      container,
      "Secondary Weapons",
      Object.values(WeaponLibrary).filter((w) => w.type === "Melee"),
      (w) => this.handleSlotChange("leftHand", w.id),
      "leftHand",
    );

    // Armor
    this.renderArmoryCategory(
      container,
      "Armor",
      Object.values(ItemLibrary).filter(
        (i) => i.id.includes("recon") || i.id.includes("plate")
      ),
      (i) => this.handleSlotChange("body", i.id),
      "body",
    );

    // Footwear
    this.renderArmoryCategory(
      container,
      "Footwear",
      Object.values(ItemLibrary).filter((i) => i.id.includes("boots")),
      (i) => this.handleSlotChange("feet", i.id),
      "feet",
    );
  }

  private createSlot(
    label: string,
    itemId: string | undefined,
    onDrop: (id: string) => void,
    category: string,
  ): HTMLElement {
    const slot = document.createElement("div");
    slot.className = "paper-doll-slot" + (itemId ? " equipped" : "");

    const title = document.createElement("div");
    title.textContent = label;
    title.style.fontSize = "0.7em";
    title.style.color = "var(--color-text-dim)";
    title.style.position = "absolute";
    title.style.top = "5px";
    slot.appendChild(title);

    if (itemId) {
      const item = WeaponLibrary[itemId] || ItemLibrary[itemId];
      if (item) {
        const name = document.createElement("div");
        name.textContent = item.name;
        name.style.fontSize = "0.8em";
        name.style.textAlign = "center";
        name.style.color = "var(--color-primary)";
        slot.appendChild(name);

        const removeBtn = document.createElement("div");
        removeBtn.textContent = "×";
        removeBtn.style.position = "absolute";
        removeBtn.style.top = "2px";
        removeBtn.style.right = "5px";
        removeBtn.style.color = "var(--color-danger)";
        removeBtn.style.cursor = "pointer";
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          onDrop("");
        };
        slot.appendChild(removeBtn);
      }
    } else {
      const plus = document.createElement("div");
      plus.textContent = "+";
      plus.style.fontSize = "2em";
      plus.style.color = "var(--color-border-strong)";
      slot.appendChild(plus);
    }

    return slot;
  }

  private renderArmoryCategory(
    panel: HTMLElement,
    title: string,
    items: (Weapon | Item)[],
    onSelect: (item: any) => void,
    slot: keyof EquipmentState,
  ) {
    const h3 = document.createElement("h3");
    h3.textContent = title;
    h3.style.fontSize = "1em";
    h3.style.color = "var(--color-primary)";
    h3.style.margin = "15px 0 5px 0";
    panel.appendChild(h3);

    const state = this.manager.getState();
    const equip = this.getEquipment(this.soldier!);

    items.forEach((item) => {
      const isCurrentlyEquipped = equip[slot] === item.id;
      const isOwned = this.isEquippedInRoster(this.soldier!.id, slot, item.id);
      const canAfford = !state || state.scrap >= item.cost;

      const btn = document.createElement("div");
      btn.className = `menu-item clickable ${isCurrentlyEquipped ? "active" : ""}`;
      if (!isCurrentlyEquipped && !isOwned && !canAfford) {
        btn.classList.add("disabled");
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
      }
      btn.style.padding = "5px 10px";
      btn.style.marginBottom = "3px";
      btn.style.fontSize = "0.85em";

      let statsHtml = "";
      let fullStats = "";
      if ("damage" in item) {
        const fireRateVal = item.fireRate;
        const fireRateStr =
          fireRateVal > 0 ? (1000 / fireRateVal).toFixed(1) : "0";
        statsHtml = `
          ${StatDisplay.render(Icons.Damage, item.damage, "Damage")}
          ${StatDisplay.render(Icons.Rate, fireRateStr, "Fire Rate")}
          ${StatDisplay.render(Icons.Range, item.range, "Range")}
        `;
        fullStats = `Damage: ${item.damage}\nRange: ${item.range}\nFire Rate: ${item.fireRate}ms\nAccuracy: ${item.accuracy > 0 ? "+" : ""}${item.accuracy}%`;
      } else {
        const bonuses = [];
        if (item.hpBonus)
          bonuses.push(StatDisplay.render(Icons.Health, item.hpBonus, "HP"));
        if (item.speedBonus)
          bonuses.push(
            StatDisplay.render(Icons.Speed, item.speedBonus / 10, "Speed")
          );
        if (item.accuracyBonus)
          bonuses.push(
            StatDisplay.render(Icons.Accuracy, item.accuracyBonus, "Accuracy")
          );
        statsHtml = bonuses.join(" ");

        const fullBonuses = [];
        if (item.hpBonus)
          fullBonuses.push(`HP: ${item.hpBonus > 0 ? "+" : ""}${item.hpBonus}`);
        if (item.speedBonus)
          fullBonuses.push(
            `Speed: ${item.speedBonus > 0 ? "+" : ""}${item.speedBonus / 10}`
          );
        if (item.accuracyBonus)
          fullBonuses.push(
            `Accuracy: ${item.accuracyBonus > 0 ? "+" : ""}${item.accuracyBonus}%`
          );
        fullStats = fullBonuses.join("\n");
      }

      btn.title = `${item.name}\n${item.description || ""}${fullStats ? "\n\n" + fullStats : ""}`;

      const priceText = isOwned || isCurrentlyEquipped ? "OWNED" : `${item.cost} CR`;
      const priceColor =
        isOwned || isCurrentlyEquipped
          ? "var(--color-primary)"
          : "var(--color-text-muted)";

      btn.innerHTML = `
            <div class="flex-col">
                <div class="flex-row justify-between" style="font-weight:bold;">
                    <span>${item.name}</span>
                    <span style="color:${priceColor};">${priceText}</span>
                </div>
                <div style="font-size:0.8em; color:var(--color-text-muted); margin-top:2px; display:flex; gap:8px;">
                    ${statsHtml}
                </div>
            </div>
        `;
      btn.onclick = () => onSelect(item);
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
        const rosterSoldier = state?.roster.find(s => s.id === soldier.id);
        if (rosterSoldier) {
            hp = rosterSoldier.maxHp;
            speed = arch.speed; // Speed is currently not increased by level in CampaignManager, but we follow archetype
            accuracy = rosterSoldier.soldierAim;
        }
    } else {
        // Fallback to config values if provided (e.g. for custom missions)
        if ("maxHp" in soldier && soldier.maxHp !== undefined) hp = soldier.maxHp;
        if ("soldierAim" in soldier && soldier.soldierAim !== undefined) accuracy = soldier.soldierAim;
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

  private getEquipment(soldier: CampaignSoldier | SquadSoldierConfig): EquipmentState {
    if ("equipment" in soldier) {
      return soldier.equipment;
    }
    return {
      rightHand: soldier.rightHand,
      leftHand: soldier.leftHand,
      body: soldier.body,
      feet: soldier.feet,
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
    const equip = this.getEquipment(this.soldier);
    if (equip[slot] === newItemId) return;

    // Check if owned (already in roster)
    const isOwned = this.isEquippedInRoster(this.soldier.id, slot, newItemId);
    
    if (newItemId !== "" && !isOwned) {
        const item = WeaponLibrary[newItemId] || ItemLibrary[newItemId];
        if (item) {
            const state = this.manager.getState();
            if (state && state.scrap < item.cost) {
                return; // Cannot afford
            }
            if (state) {
                this.manager.spendScrap(item.cost);
            }
        }
    }

    // Update the soldier object
    if ("equipment" in this.soldier) {
        this.soldier.equipment[slot] = newItemId || undefined;
        this.manager.assignEquipment(this.soldier.id, this.soldier.equipment);
    } else {
        (this.soldier as any)[slot] = newItemId || undefined;
        // Persistence: write back to CampaignManager if it's a roster soldier
        if (this.soldier.id) {
            const state = this.manager.getState();
            const rosterSoldier = state?.roster.find(s => s.id === this.soldier!.id);
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