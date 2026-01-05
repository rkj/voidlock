import {
  SquadConfig,
  ItemLibrary,
  WeaponLibrary,
  ArchetypeLibrary,
  SquadSoldierConfig,
  Item,
  Weapon,
  Archetype,
} from "../../shared/types";
import { Icons } from "../Icons";
import { StatDisplay } from "../ui/StatDisplay";

export class EquipmentScreen {
  private container: HTMLElement;
  private config: SquadConfig;
  private selectedSoldierIndex: number = 0;
  private onSave: (config: SquadConfig) => void;
  private onBack: () => void;

  constructor(
    containerId: string,
    initialConfig: SquadConfig,
    onSave: (config: SquadConfig) => void,
    onBack: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.config = JSON.parse(JSON.stringify(initialConfig)); // Deep copy
    this.applyDefaults();
    this.onSave = onSave;
    this.onBack = onBack;
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
  }

  public hide() {
    this.container.style.display = "none";
  }

  public updateConfig(config: SquadConfig) {
    this.config = JSON.parse(JSON.stringify(config));
    this.applyDefaults();
    this.selectedSoldierIndex = 0;
    this.render();
  }

  private applyDefaults() {
    this.config.soldiers.forEach((soldier) => {
      const arch = ArchetypeLibrary[soldier.archetypeId];
      if (!arch) return;

      if (soldier.rightHand === undefined && arch.rightHand) {
        soldier.rightHand = arch.rightHand;
      }
      if (soldier.leftHand === undefined && arch.leftHand) {
        soldier.leftHand = arch.leftHand;
      }
      if (soldier.body === undefined && arch.body) {
        soldier.body = arch.body;
      }
      if (soldier.feet === undefined && arch.feet) {
        soldier.feet = arch.feet;
      }
    });
  }

  private render() {
    this.container.innerHTML = "";
    this.container.className =
      "screen equipment-screen flex-row p-20 gap-20 relative";
    this.container.style.display = "flex";

    // Left: Soldier List
    const leftPanel = this.createPanel("Soldier List", "250px");
    this.renderSoldierList(leftPanel);

    // Center: Paper Doll / Slots
    const centerPanel = this.createPanel("Soldier Equipment", "1fr");
    this.renderPaperDoll(centerPanel);

    // Right: Armory / Global Inventory
    const rightPanel = this.createPanel("Armory & Supplies", "400px");
    this.renderArmory(rightPanel);

    this.container.appendChild(leftPanel);
    this.container.appendChild(centerPanel);
    this.container.appendChild(rightPanel);

    // Footer Buttons
    const footer = document.createElement("div");
    footer.className = "screen-footer screen-footer-right";

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK";
    backBtn.className = "back-button";
    backBtn.onclick = () => this.onBack();

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "CONFIRM SQUAD";
    saveBtn.onclick = () => this.onSave(this.config);

    footer.appendChild(backBtn);
    footer.appendChild(saveBtn);
    this.container.appendChild(footer);
  }

  private createPanel(title: string, width: string): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.style.width = width === "1fr" ? "auto" : width;
    if (width === "1fr") panel.style.flexGrow = "1";

    const h2 = document.createElement("h2");
    h2.className = "panel-title";
    h2.textContent = title;
    panel.appendChild(h2);

    return panel;
  }

  private renderSoldierList(panel: HTMLElement) {
    this.config.soldiers.forEach((soldier, index) => {
      const item = document.createElement("div");
      item.className = `menu-item clickable ${this.selectedSoldierIndex === index ? "active" : ""}`;
      item.style.marginBottom = "10px";
      item.style.padding = "10px";

      const arch = ArchetypeLibrary[soldier.archetypeId];
      item.innerHTML = `
        <div style="font-weight:bold; color:${this.selectedSoldierIndex === index ? "var(--color-primary)" : "var(--color-text)"};">
          ${index + 1}. ${arch ? arch.name : soldier.archetypeId}
        </div>
        <div style="font-size:0.8em; color:var(--color-text-muted); margin-top:4px;">
          ${this.getItemName(soldier.rightHand)} / ${this.getItemName(soldier.leftHand)}
        </div>
      `;

      item.onclick = () => {
        this.selectedSoldierIndex = index;
        this.render();
      };
      panel.appendChild(item);
    });
  }

  private getItemName(id?: string): string {
    if (!id) return "Empty";
    const item = WeaponLibrary[id] || ItemLibrary[id];
    return item ? item.name : id;
  }

  private renderPaperDoll(panel: HTMLElement) {
    const soldier = this.config.soldiers[this.selectedSoldierIndex];
    if (!soldier) {
      panel.innerHTML += "<p>No soldier selected</p>";
      return;
    }

    const content = document.createElement("div");
    content.className = "flex-col align-center gap-20";
    content.style.marginTop = "20px";

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

    const sStats = this.calculateSoldierStats(soldier);
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
    h3Weapon.textContent = "EQUIPPED WEAPONRY";
    h3Weapon.className = "stat-label";
    h3Weapon.style.margin = "0 0 10px 0";
    h3Weapon.style.letterSpacing = "1px";
    weaponStatsDiv.appendChild(h3Weapon);

    const rw = this.getWeaponStats(soldier.rightHand, sStats.speed);
    const lw = this.getWeaponStats(soldier.leftHand, sStats.speed);

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
        soldier.rightHand,
        (id) => {
          soldier.rightHand = id;
          this.render();
        },
        "Weapon",
      ),
    );

    slotsGrid.appendChild(
      this.createSlot(
        "Left Hand",
        soldier.leftHand,
        (id) => {
          soldier.leftHand = id;
          this.render();
        },
        "Weapon",
      ),
    );

    slotsGrid.appendChild(
      this.createSlot(
        "Body",
        soldier.body,
        (id) => {
          soldier.body = id;
          this.render();
        },
        "Armor",
      ),
    );

    slotsGrid.appendChild(
      this.createSlot(
        "Feet",
        soldier.feet,
        (id) => {
          soldier.feet = id;
          this.render();
        },
        "Feet",
      ),
    );

    content.appendChild(slotsGrid);
    panel.appendChild(content);
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

    slot.onclick = () => {
      // In a real UI we might open a selection menu or handle drag/drop
    };

    return slot;
  }

  private renderArmory(panel: HTMLElement) {
    // Ranged Weapons
    this.renderCategory(
      panel,
      "Ranged Weapons",
      Object.values(WeaponLibrary).filter((w) => w.type === "Ranged"),
      (w) => {
        const s = this.config.soldiers[this.selectedSoldierIndex];
        s.rightHand = w.id;
        this.render();
      },
    );

    // Melee Weapons
    this.renderCategory(
      panel,
      "Melee Weapons",
      Object.values(WeaponLibrary).filter((w) => w.type === "Melee"),
      (w) => {
        const s = this.config.soldiers[this.selectedSoldierIndex];
        s.leftHand = w.id;
        this.render();
      },
    );

    // Armor & Gear
    this.renderCategory(
      panel,
      "Armor",
      Object.values(ItemLibrary).filter(
        (i) => i.id.includes("recon") || i.id.includes("plate"),
      ),
      (i) => {
        const s = this.config.soldiers[this.selectedSoldierIndex];
        s.body = i.id;
        this.render();
      },
    );

    this.renderCategory(
      panel,
      "Footwear",
      Object.values(ItemLibrary).filter((i) => i.id.includes("boots")),
      (i) => {
        const s = this.config.soldiers[this.selectedSoldierIndex];
        s.feet = i.id;
        this.render();
      },
    );

    // Global Supplies
    const suppliesTitle = document.createElement("h3");
    suppliesTitle.textContent = "Global Supplies";
    suppliesTitle.style.color = "var(--color-primary)";
    suppliesTitle.style.borderBottom = "1px solid var(--color-border)";
    suppliesTitle.style.paddingBottom = "5px";
    panel.appendChild(suppliesTitle);

    const supplyItems = Object.values(ItemLibrary).filter((i) => i.action);
    supplyItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "flex-row justify-between align-center card";
      row.style.marginBottom = "5px";
      row.style.padding = "5px";
      row.style.gap = "0";
      row.title = `${item.name}\n${item.description || ""}\nCharges: ${item.charges}\nCost: ${item.cost} CR`;

      const name = document.createElement("span");
      name.textContent = item.name;
      name.style.fontSize = "0.9em";

      const controls = document.createElement("div");
      controls.className = "flex-row align-center gap-10";

      const count = this.config.inventory[item.id] || 0;

      const minus = document.createElement("button");
      minus.textContent = "-";
      minus.style.padding = "2px 8px";
      minus.onclick = () => {
        if (count > 0) {
          this.config.inventory[item.id] = count - 1;
          this.render();
        }
      };

      const countDisplay = document.createElement("span");
      countDisplay.textContent = count.toString();
      countDisplay.style.minWidth = "20px";
      countDisplay.style.textAlign = "center";

      const plus = document.createElement("button");
      plus.textContent = "+";
      plus.style.padding = "2px 8px";
      plus.onclick = () => {
        this.config.inventory[item.id] = count + 1;
        this.render();
      };

      controls.appendChild(minus);
      controls.appendChild(countDisplay);
      controls.appendChild(plus);

      row.appendChild(name);
      row.appendChild(controls);
      panel.appendChild(row);
    });
  }

  private renderCategory(
    panel: HTMLElement,
    title: string,
    items: (Weapon | Item)[],
    onSelect: (item: any) => void,
  ) {
    const h3 = document.createElement("h3");
    h3.textContent = title;
    h3.style.fontSize = "1em";
    h3.style.color = "var(--color-primary)";
    h3.style.margin = "15px 0 5px 0";
    panel.appendChild(h3);

    items.forEach((item) => {
      const btn = document.createElement("div");
      btn.className = "menu-item clickable";
      btn.style.padding = "5px 10px";
      btn.style.marginBottom = "3px";
      btn.style.fontSize = "0.85em";

      let statsHtml = "";
      let fullStats = "";
      if ("damage" in item) {
        // Weapon
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
        // Item (Armor/Boots)
        const bonuses = [];
        if (item.hpBonus)
          bonuses.push(StatDisplay.render(Icons.Health, item.hpBonus, "HP"));
        if (item.speedBonus)
          bonuses.push(
            StatDisplay.render(Icons.Speed, item.speedBonus / 10, "Speed"),
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
            `Speed: ${item.speedBonus > 0 ? "+" : ""}${item.speedBonus / 10}`,
          );
        if (item.accuracyBonus)
          fullBonuses.push(
            `Accuracy: ${item.accuracyBonus > 0 ? "+" : ""}${item.accuracyBonus}%`,
          );
        fullStats = fullBonuses.join("\n");
      }

      btn.title = `${item.name}\n${item.description || ""}${fullStats ? "\n\n" + fullStats : ""}`;

      btn.innerHTML = `
            <div class="flex-col">
                <div class="flex-row justify-between" style="font-weight:bold;">
                    <span>${item.name}</span>
                    <span style="color:var(--color-text-muted);">${item.cost} CR</span>
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

  private calculateSoldierStats(soldier: SquadSoldierConfig) {
    const arch = ArchetypeLibrary[soldier.archetypeId];
    if (!arch) return { hp: 0, speed: 0, accuracy: 0 };

    let hp = arch.baseHp;
    let speed = arch.speed;
    let accuracy = arch.soldierAim;

    // Apply equipment bonuses
    const slots = [
      soldier.body,
      soldier.feet,
      soldier.rightHand,
      soldier.leftHand,
    ];
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

    // Fire rate in the engine is scaled by speed: fireRate * (speed > 0 ? 10 / speed : 1)
    // We want to show rounds per second: 1000 / scaledFireRate
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

  private calculateStats(soldier: SquadSoldierConfig) {
    const s = this.calculateSoldierStats(soldier);
    const rw = this.getWeaponStats(soldier.rightHand, s.speed);
    return {
      hp: s.hp,
      speed: s.speed,
      accuracy: s.accuracy,
      damage: rw ? rw.damage : 0,
    };
  }
}
