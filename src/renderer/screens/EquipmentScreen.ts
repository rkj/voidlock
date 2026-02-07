import { SquadConfig, ItemLibrary, ArchetypeLibrary, InputPriority } from "@src/shared/types";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { SoldierInspector } from "@src/renderer/ui/SoldierInspector";
import { NameGenerator } from "@src/shared/utils/NameGenerator";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { InputDispatcher } from "../InputDispatcher";
import { UIUtils } from "../utils/UIUtils";

export class EquipmentScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private config: SquadConfig;
  private selectedSoldierIndex: number = 0;
  private recruitMode: boolean = false;
  private reviveMode: boolean = false;
  private onSave: (config: SquadConfig) => void;
  private onBack: () => void;
  private onUpdate?: () => void;
  private inspector: SoldierInspector;
  private isShop: boolean = false;
  private savedScrollTop: { left: number; center: number; right: number } = {
    left: 0,
    center: 0,
    right: 0,
  };

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
      onRecruit: () => {
        this.recruitMode = true;
        this.reviveMode = false;
        this.render();
      },
      onRevive: () => {
        this.reviveMode = true;
        this.recruitMode = false;
        this.render();
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
    this.pushInputContext();
  }

  public hide() {
    this.container.style.display = "none";
    InputDispatcher.getInstance().popContext("equipment");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
      id: "equipment",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: this.container,
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [
        { key: "Arrows", label: "Navigate", description: "Move selection", category: "Navigation" },
        { key: "Enter", label: "Select", description: "Activate button", category: "Navigation" },
        { key: "ESC", label: "Back", description: "Return to previous screen", category: "Navigation" },
      ],
    });
  }

  private handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      return UIUtils.handleArrowNavigation(e, this.container);
    }
    if (e.key === "Escape") {
      this.onBack();
      return true;
    }
    return false;
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
    // Save scroll positions before clearing
    const oldLeft = this.container.querySelector(".soldier-list-panel");
    const oldCenter = this.container.querySelector(".soldier-equipment-panel");
    const oldRight = this.container.querySelector(".armory-panel");
    if (oldLeft) this.savedScrollTop.left = oldLeft.scrollTop;
    if (oldCenter) this.savedScrollTop.center = oldCenter.scrollTop;
    if (oldRight) this.savedScrollTop.right = oldRight.scrollTop;

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
    leftPanel.classList.add("soldier-list-panel");
    leftPanel.style.overflowY = "auto";
    leftPanel.style.padding = "10px";
    this.renderSoldierList(leftPanel);

    // Center: Paper Doll / Slots
    const centerPanel = this.createPanel("Soldier Equipment", "1fr");
    centerPanel.classList.add("soldier-equipment-panel");
    centerPanel.style.overflowY = "auto";
    centerPanel.style.padding = "10px";
    const centerBody = document.createElement("div");
    centerPanel.appendChild(centerBody);
    this.inspector.setSoldier(this.config.soldiers[this.selectedSoldierIndex]);
    this.inspector.renderDetails(centerBody);

    // Right: Armory / Global Inventory OR Roster Picker OR Recruitment OR Revive
    const isSlotEmpty = !this.config.soldiers[this.selectedSoldierIndex];
    let rightPanelTitle = "Armory & Supplies";
    if (this.recruitMode) rightPanelTitle = "Recruitment";
    else if (this.reviveMode) rightPanelTitle = "Revive Personnel";
    else if (isSlotEmpty) rightPanelTitle = "Reserve Roster";

    const rightPanel = this.createPanel(rightPanelTitle, "400px");
    rightPanel.classList.add("armory-panel");
    rightPanel.style.overflowY = "auto";
    rightPanel.style.padding = "10px";

    if (this.recruitMode) {
      this.renderRecruitmentPicker(rightPanel);
    } else if (this.reviveMode) {
      this.renderRevivePicker(rightPanel);
    } else if (isSlotEmpty) {
      this.renderRosterPicker(rightPanel);
    } else {
      this.renderRightPanel(rightPanel);
    }

    contentWrapper.appendChild(leftPanel);
    contentWrapper.appendChild(centerPanel);
    contentWrapper.appendChild(rightPanel);
    this.container.appendChild(contentWrapper);

    // Restore scroll positions
    leftPanel.scrollTop = this.savedScrollTop.left;
    centerPanel.scrollTop = this.savedScrollTop.center;
    rightPanel.scrollTop = this.savedScrollTop.right;

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
    for (let i = 0; i < 4; i++) {
      const soldier = this.config.soldiers[i];
      let item: HTMLElement;

      if (soldier) {
        item = SoldierWidget.render(soldier, {
          context: "roster",
          selected: this.selectedSoldierIndex === i,
          prefix: `${i + 1}. `,
          onClick: () => {
            this.selectedSoldierIndex = i;
            this.recruitMode = false;
            this.reviveMode = false;
            this.render();
          },
        });

        // Add remove button
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-soldier-btn";
        removeBtn.innerHTML = "×";
        removeBtn.title = "Remove from Squad";
        removeBtn.style.position = "absolute";
        removeBtn.style.top = "5px";
        removeBtn.style.right = "5px";
        removeBtn.style.background = "transparent";
        removeBtn.style.border = "none";
        removeBtn.style.color = "var(--color-danger)";
        removeBtn.style.cursor = "pointer";
        removeBtn.style.fontSize = "1.2em";
        removeBtn.style.padding = "0 5px";
        removeBtn.style.zIndex = "10";
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          this.config.soldiers.splice(i, 1);
          this.render();
        };
        item.style.position = "relative";
        item.appendChild(removeBtn);
      } else {
        item = document.createElement("div");
        item.className = `menu-item clickable ${this.selectedSoldierIndex === i ? "active" : ""}`;
        item.style.marginBottom = "8px";
        item.style.padding = "8px 12px";
        item.innerHTML = `
          <div style="font-weight:bold; color:${this.selectedSoldierIndex === i ? "var(--color-primary)" : "var(--color-text-dim)"}; font-size: 0.9em;">
            ${i + 1}. [Empty Slot]
          </div>
          <div style="font-size:0.75em; color:var(--color-text-muted); margin-top:2px;">
            Click to add soldier
          </div>
        `;
        item.onclick = () => {
          this.selectedSoldierIndex = i;
          this.recruitMode = false;
          this.reviveMode = false;
          this.render();
        };
      }

      panel.appendChild(item);
    }
  }

  private renderRosterPicker(panel: HTMLElement) {
    const state = this.manager.getState();
    if (!state) {
      // In Custom Mode, maybe we show archetypes?
      this.renderArchetypePicker(panel);
      return;
    }

    const squadIds = new Set(
      this.config.soldiers.map((s) => s.id).filter(Boolean),
    );
    const available = state.roster.filter(
      (s) => s.status === "Healthy" && !squadIds.has(s.id),
    );

    if (available.length === 0) {
      const msg = document.createElement("div");
      msg.className = "flex-col align-center justify-center h-full";
      msg.style.color = "var(--color-text-dim)";
      msg.style.padding = "20px";
      msg.style.textAlign = "center";
      msg.innerHTML = `
        <div style="font-size:2em; margin-bottom:10px;">📋</div>
        <div>No healthy soldiers available in roster.</div>
        <div style="font-size:0.8em; margin-top:10px;">Recruit a new soldier in the center panel.</div>
      `;
      panel.appendChild(msg);
      return;
    }

    available.forEach((soldier) => {
      const item = SoldierWidget.render(soldier, {
        context: "roster",
        onClick: () => {
          this.config.soldiers[this.selectedSoldierIndex] = {
            id: soldier.id,
            name: soldier.name,
            archetypeId: soldier.archetypeId,
            hp: soldier.hp,
            maxHp: soldier.maxHp,
            soldierAim: soldier.soldierAim,
            rightHand: soldier.equipment.rightHand,
            leftHand: soldier.equipment.leftHand,
            body: soldier.equipment.body,
            feet: soldier.equipment.feet,
          };
          this.render();
        },
      });
      panel.appendChild(item);
    });
  }

  private renderRecruitmentPicker(panel: HTMLElement) {
    const state = this.manager.getState();
    if (!state) return;

    const archetypes = state.unlockedArchetypes;
    const cost = 100; // Match RosterManager

    archetypes.forEach((archId) => {
      const arch = ArchetypeLibrary[archId];
      if (!arch) return;

      const item = SoldierWidget.render(arch, {
        context: "squad-builder",
        price: `${cost} CR`,
        onClick: () => {
          const id = this.manager.recruitSoldier(archId);
          const newState = this.manager.getState();
          const soldier = newState?.roster.find((s) => s.id === id);
          if (soldier) {
            this.config.soldiers[this.selectedSoldierIndex] = {
              id: soldier.id,
              name: soldier.name,
              archetypeId: soldier.archetypeId,
              hp: soldier.hp,
              maxHp: soldier.maxHp,
              soldierAim: soldier.soldierAim,
              rightHand: soldier.equipment.rightHand,
              leftHand: soldier.equipment.leftHand,
              body: soldier.equipment.body,
              feet: soldier.equipment.feet,
            };
            this.recruitMode = false;
            this.render();
          }
        },
      });

      if (state.scrap < cost) {
        item.classList.add("disabled");
        item.style.opacity = "0.5";
        item.style.pointerEvents = "none";
      }

      panel.appendChild(item);
    });
  }

  private renderRevivePicker(panel: HTMLElement) {
    const state = this.manager.getState();
    if (!state) return;

    const deadSoldiers = state.roster.filter((s) => s.status === "Dead");
    const cost = 250; // Match RosterManager

    if (deadSoldiers.length === 0) {
      panel.innerHTML =
        '<div style="text-align:center; color:var(--color-text-dim); margin-top:20px;">No deceased personnel available for revival.</div>';
      return;
    }

    deadSoldiers.forEach((soldier) => {
      const item = SoldierWidget.render(soldier, {
        context: "squad-builder",
        price: `${cost} CR`,
        onClick: () => {
          this.manager.reviveSoldier(soldier.id);
          const newState = this.manager.getState();
          const revived = newState?.roster.find((s) => s.id === soldier.id);
          if (revived) {
            this.config.soldiers[this.selectedSoldierIndex] = {
              id: revived.id,
              name: revived.name,
              archetypeId: revived.archetypeId,
              hp: revived.hp,
              maxHp: revived.maxHp,
              soldierAim: revived.soldierAim,
              rightHand: revived.equipment.rightHand,
              leftHand: revived.equipment.leftHand,
              body: revived.equipment.body,
              feet: revived.equipment.feet,
            };
            this.reviveMode = false;
            this.render();
          }
        },
      });

      if (state.scrap < cost) {
        item.classList.add("disabled");
        item.style.opacity = "0.5";
        item.style.pointerEvents = "none";
      }

      panel.appendChild(item);
    });
  }

  private renderArchetypePicker(panel: HTMLElement) {
    Object.values(ArchetypeLibrary).forEach((arch) => {
      if (arch.id === "vip") return; // VIPs are handled separately or by nodes

      const item = SoldierWidget.render(arch, {
        context: "squad-builder",
        onClick: () => {
          this.config.soldiers[this.selectedSoldierIndex] = {
            name: NameGenerator.generate(),
            archetypeId: arch.id,
            hp: arch.baseHp,
            maxHp: arch.baseHp,
            soldierAim: arch.soldierAim,
            rightHand: arch.rightHand,
            leftHand: arch.leftHand,
            body: arch.body,
            feet: arch.feet,
          };
          this.render();
        },
      });

      panel.appendChild(item);
    });
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

    const state = this.manager.getState();
    const unlockedItems = state?.unlockedItems || [];
    const basicSupplies = ["frag_grenade", "medkit", "mine"];

    const isUnlocked = (id: string) =>
      basicSupplies.includes(id) || unlockedItems.includes(id);

    const supplyItems = Object.values(ItemLibrary).filter(
      (i) => i.action && isUnlocked(i.id),
    );
    supplyItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "flex-row justify-between align-center card w-full";
      row.style.marginBottom = "8px";
      row.style.padding = "8px 12px";
      row.style.gap = "10px";
      row.title = `${item.name}\n${item.description || ""}`;

      const nameGroup = document.createElement("div");
      nameGroup.className = "flex-col";
      nameGroup.style.flexGrow = "1";
      nameGroup.innerHTML = `
        <div class="flex-row justify-between" style="font-weight:bold; font-size: 0.9em; width: 100%;">
            <span>${item.name}</span>
            <span style="color:var(--color-primary);">${item.cost} CR</span>
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
