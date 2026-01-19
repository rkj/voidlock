import {
  SquadConfig,
  ItemLibrary,
  WeaponLibrary,
  ArchetypeLibrary,
  SquadSoldierConfig,
  Item,
  Weapon,
  Archetype,
  EquipmentState,
} from "@src/shared/types";
import { Icons } from "@src/renderer/Icons";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { SoldierInspector } from "@src/renderer/ui/SoldierInspector";

export class EquipmentScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private config: SquadConfig;
  private selectedSoldierIndex: number = 0;
  private onSave: (config: SquadConfig) => void;
  private onBack: () => void;
  private onUpdate?: () => void;
  private inspector: SoldierInspector;
  private isShop: boolean = false;

  constructor(
    containerId: string,
    manager: CampaignManager,
    initialConfig: SquadConfig,
    onSave: (config: SquadConfig) => void,
    onBack: () => void,
    onUpdate?: () => void,
    isShop: boolean = false,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.config = JSON.parse(JSON.stringify(initialConfig)); // Deep copy
    this.applyDefaults();
    this.onSave = onSave;
    this.onBack = onBack;
    this.onUpdate = onUpdate;
    this.isShop = isShop;
    this.inspector = new SoldierInspector({
      manager: this.manager,
      onUpdate: () => {
        this.render();
        if (this.onUpdate) this.onUpdate();
      },
    });
    this.inspector.setShop(this.isShop);
  }

  public setShop(isShop: boolean) {
    this.isShop = isShop;
    this.inspector.setShop(isShop);
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
    this.container.className = "screen equipment-screen flex-col h-full";
    this.container.style.display = "flex";
    this.container.style.overflow = "hidden";

    // Main Content Wrapper (Flex Row for panels)
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex-row flex-grow p-10 gap-10";
    contentWrapper.style.overflow = "hidden";
    contentWrapper.style.minHeight = "0"; // Crucial for nested flex scrolling

    // Left: Soldier List
    const leftPanel = this.createPanel("Soldier List", "250px");
    leftPanel.style.overflowY = "auto";
    leftPanel.style.padding = "10px";
    this.renderSoldierList(leftPanel);

    // Center: Paper Doll / Slots
    const centerPanel = this.createPanel("Soldier Equipment", "1fr");
    centerPanel.style.overflowY = "auto";
    centerPanel.style.padding = "10px";
    const centerBody = document.createElement("div");
    centerPanel.appendChild(centerBody);
    this.inspector.setSoldier(this.config.soldiers[this.selectedSoldierIndex], true);
    this.inspector.renderDetails(centerBody);

    // Right: Armory / Global Inventory
    const rightPanel = this.createPanel("Armory & Supplies", "400px");
    rightPanel.style.overflowY = "auto";
    rightPanel.style.padding = "10px";
    this.renderRightPanel(rightPanel);

    contentWrapper.appendChild(leftPanel);
    contentWrapper.appendChild(centerPanel);
    contentWrapper.appendChild(rightPanel);
    this.container.appendChild(contentWrapper);

    // Footer Buttons (Direct child of container)
    const footer = document.createElement("div");
    footer.className = "flex-row justify-end p-10 gap-10";
    footer.style.flexShrink = "0";
    footer.style.borderTop = "1px solid var(--color-border-strong)";
    footer.style.backgroundColor = "var(--color-surface-elevated)";

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.className = "back-button";
    backBtn.style.margin = "0";
    backBtn.style.height = "32px";
    backBtn.style.padding = "0 15px";
    backBtn.style.fontSize = "0.9em";
    backBtn.style.display = "flex";
    backBtn.style.alignItems = "center";
    backBtn.onclick = () => this.onBack();

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Confirm Squad";
    saveBtn.className = "primary-button";
    saveBtn.style.margin = "0";
    saveBtn.style.height = "32px";
    saveBtn.style.padding = "0 15px";
    saveBtn.style.fontSize = "0.9em";
    saveBtn.style.display = "flex";
    saveBtn.style.alignItems = "center";
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
      item.style.marginBottom = "8px";
      item.style.padding = "8px 12px";

      const arch = ArchetypeLibrary[soldier.archetypeId];
      item.innerHTML = `
        <div style="font-weight:bold; color:${this.selectedSoldierIndex === index ? "var(--color-primary)" : "var(--color-text)"}; font-size: 0.9em;">
          ${index + 1}. ${arch ? arch.name : soldier.archetypeId}
        </div>
        <div style="font-size:0.75em; color:var(--color-text-muted); margin-top:2px;">
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

  private renderRightPanel(panel: HTMLElement) {
    // We use the inspector for the Armory part, but we still need the Supplies part
    const armoryBody = document.createElement("div");
    panel.appendChild(armoryBody);
    this.inspector.renderArmory(armoryBody);

    // Global Supplies
    const suppliesTitle = document.createElement("h3");
    suppliesTitle.textContent = "Global Supplies";
    suppliesTitle.style.color = "var(--color-primary)";
    suppliesTitle.style.borderBottom = "1px solid var(--color-border)";
    suppliesTitle.style.paddingBottom = "8px";
    suppliesTitle.style.margin = "20px 0 12px 0";
    suppliesTitle.style.fontSize = "1em";
    suppliesTitle.style.textTransform = "uppercase";
    suppliesTitle.style.letterSpacing = "1px";
    panel.appendChild(suppliesTitle);

    const supplyItems = Object.values(ItemLibrary).filter((i) => i.action);
    supplyItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "flex-row justify-between align-center card";
      row.style.marginBottom = "8px";
      row.style.padding = "8px 12px";
      row.style.gap = "10px";
      row.title = `${item.name}\n${item.description || ""}\nCharges: ${item.charges}`;

      const nameGroup = document.createElement("div");
      nameGroup.className = "flex-col";
      nameGroup.style.flexGrow = "1";
      nameGroup.innerHTML = `
        <div class="flex-row justify-between" style="font-weight:bold; font-size: 0.9em;">
            <span>${item.name}</span>
            <span style="color:var(--color-primary);">${item.cost} CR</span>
        </div>
        <div style="font-size:0.75em; color:var(--color-text-muted); margin-top:2px;">
            Charges: ${item.charges}
        </div>
      `;

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
      if (count >= 2) {
        plus.disabled = true;
        plus.title = "Maximum 2 per mission reached";
      }
      plus.onclick = () => {
        if (count < 2) {
          const state = this.manager.getState();
          if (state && state.scrap < item.cost) return;
          if (state) this.manager.spendScrap(item.cost);
          
          this.config.inventory[item.id] = count + 1;
          this.render();
        }
      };

      controls.appendChild(minus);
      controls.appendChild(countDisplay);
      controls.appendChild(plus);

      row.appendChild(nameGroup);
      row.appendChild(controls);
      panel.appendChild(row);
    });
  }
}
