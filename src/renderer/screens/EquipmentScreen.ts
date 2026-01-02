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
    this.container.className = "screen equipment-screen";
    this.container.style.flexDirection = "row";
    this.container.style.backgroundColor = "#111";
    this.container.style.color = "#eee";
    this.container.style.padding = "20px";
    this.container.style.boxSizing = "border-box";
    this.container.style.gap = "20px";

    // Left: Soldier List
    const leftPanel = this.createPanel("Soldier List", "250px");
    this.renderSoldierList(leftPanel);

    // Center: Paper Doll / Slots
    const centerPanel = this.createPanel("Soldier Equipment", "1fr");
    this.renderPaperDoll(centerPanel);

    // Right: Armory / Global Inventory
    const rightPanel = this.createPanel("Armory & Supplies", "350px");
    this.renderArmory(rightPanel);

    this.container.appendChild(leftPanel);
    this.container.appendChild(centerPanel);
    this.container.appendChild(rightPanel);

    // Footer Buttons
    const footer = document.createElement("div");
    footer.style.position = "absolute";
    footer.style.bottom = "20px";
    footer.style.right = "20px";
    footer.style.display = "flex";
    footer.style.gap = "10px";

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
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.width = width === "1fr" ? "auto" : width;
    if (width === "1fr") panel.style.flexGrow = "1";
    panel.style.border = "1px solid #444";
    panel.style.background = "#1a1a1a";
    panel.style.padding = "15px";
    panel.style.overflowY = "auto";

    const h2 = document.createElement("h2");
    h2.textContent = title;
    h2.style.marginTop = "0";
    h2.style.fontSize = "1.2em";
    h2.style.borderBottom = "1px solid #333";
    h2.style.paddingBottom = "10px";
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
        <div style="font-weight:bold; color:${this.selectedSoldierIndex === index ? "#0f0" : "#eee"};">
          ${index + 1}. ${arch ? arch.name : soldier.archetypeId}
        </div>
        <div style="font-size:0.8em; color:#888; margin-top:4px;">
          ${soldier.rightHand || "Empty"} / ${soldier.leftHand || "Empty"}
        </div>
      `;

      item.onclick = () => {
        this.selectedSoldierIndex = index;
        this.render();
      };
      panel.appendChild(item);
    });
  }

  private renderPaperDoll(panel: HTMLElement) {
    const soldier = this.config.soldiers[this.selectedSoldierIndex];
    if (!soldier) {
      panel.innerHTML += "<p>No soldier selected</p>";
      return;
    }

    const arch = ArchetypeLibrary[soldier.archetypeId];

    const content = document.createElement("div");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.alignItems = "center";
    content.style.marginTop = "20px";
    content.style.gap = "20px";

    // Stats Summary
    const stats = document.createElement("div");
    stats.style.display = "grid";
    stats.style.gridTemplateColumns = "1fr 1fr";
    stats.style.gap = "10px";
    stats.style.width = "100%";
    stats.style.maxWidth = "300px";
    stats.style.fontSize = "0.9em";
    stats.style.background = "#111";
    stats.style.padding = "10px";
    stats.style.border = "1px solid #333";

    const currentStats = this.calculateStats(soldier);
    stats.innerHTML = `
      <span>HP:</span><span style="color:#0f0">${currentStats.hp}</span>
      <span>Speed:</span><span style="color:#0f0">${currentStats.speed}</span>
      <span>Accuracy:</span><span style="color:#0f0">${currentStats.accuracy}%</span>
      <span>Damage:</span><span style="color:#0f0">${currentStats.damage}</span>
    `;
    content.appendChild(stats);

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
    slot.style.width = "100px";
    slot.style.height = "100px";
    slot.style.border = "2px dashed #444";
    slot.style.background = "#111";
    slot.style.display = "flex";
    slot.style.flexDirection = "column";
    slot.style.alignItems = "center";
    slot.style.justifyContent = "center";
    slot.style.position = "relative";
    slot.style.cursor = "pointer";

    const title = document.createElement("div");
    title.textContent = label;
    title.style.fontSize = "0.7em";
    title.style.color = "#666";
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
        name.style.color = "#0f0";
        slot.appendChild(name);

        slot.style.borderStyle = "solid";
        slot.style.borderColor = "#0f0";

        const removeBtn = document.createElement("div");
        removeBtn.textContent = "×";
        removeBtn.style.position = "absolute";
        removeBtn.style.top = "2px";
        removeBtn.style.right = "5px";
        removeBtn.style.color = "#f00";
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
      plus.style.color = "#333";
      slot.appendChild(plus);
    }

    slot.onclick = () => {
      // In a real UI we might open a selection menu or handle drag/drop
      // For this prototype, clicking a slot could highlight available items in the Armory
      // but we'll just keep it simple.
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
    suppliesTitle.style.color = "#0f0";
    suppliesTitle.style.borderBottom = "1px solid #333";
    suppliesTitle.style.paddingBottom = "5px";
    panel.appendChild(suppliesTitle);

    const supplyItems = Object.values(ItemLibrary).filter((i) => i.action);
    supplyItems.forEach((item) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.marginBottom = "5px";
      row.style.padding = "5px";
      row.style.border = "1px solid #333";

      const name = document.createElement("span");
      name.textContent = item.name;
      name.style.fontSize = "0.9em";

      const controls = document.createElement("div");
      controls.style.display = "flex";
      controls.style.alignItems = "center";
      controls.style.gap = "10px";

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
    h3.style.color = "#0f0";
    h3.style.margin = "15px 0 5px 0";
    panel.appendChild(h3);

    items.forEach((item) => {
      const btn = document.createElement("div");
      btn.className = "menu-item clickable";
      btn.style.padding = "5px 10px";
      btn.style.marginBottom = "3px";
      btn.style.fontSize = "0.85em";
      btn.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span>${item.name}</span>
                <span style="color:#888;">${item.cost} CR</span>
            </div>
        `;
      btn.onclick = () => onSelect(item);
      panel.appendChild(btn);
    });
  }

  private calculateStats(soldier: SquadSoldierConfig) {
    const arch = ArchetypeLibrary[soldier.archetypeId];
    if (!arch) return { hp: 0, speed: 0, accuracy: 0, damage: 0 };

    let hp = arch.baseHp;
    let speed = arch.speed;
    let accuracy = arch.soldierAim;
    let damage = arch.damage;

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
      const weapon = WeaponLibrary[id];
      if (weapon) {
        // Weapon accuracy is a modifier to soldierAim?
        // Types say: accuracy: number; // Percentage modifier relative to soldierAim
        // But we'll just show the weapon damage/accuracy for now.
        damage = Math.max(damage, weapon.damage);
      }
    });

    return { hp, speed, accuracy, damage };
  }
}
