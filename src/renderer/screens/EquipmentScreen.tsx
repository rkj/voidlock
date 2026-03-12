import { createElement, Fragment } from "@src/renderer/jsx";
import {
  SquadConfig,
  ItemLibrary,
  ArchetypeLibrary,
  InputPriority,
} from "@src/shared/types";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { SoldierInspector } from "@src/renderer/ui/SoldierInspector";
import { NameGenerator } from "@src/shared/utils/NameGenerator";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";
import { InputDispatcher } from "../InputDispatcher";
import { UIUtils } from "../utils/UIUtils";
import { FocusManager } from "../utils/FocusManager";

import { ModalService } from "@src/renderer/ui/ModalService";

export class EquipmentScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private modalService: ModalService;
  private config: SquadConfig;
  private selectedSoldierIndex: number = 0;
  private recruitMode: boolean = false;
  private reviveMode: boolean = false;
  private onLaunch?: (config: SquadConfig) => void;
  private onBack: (config: SquadConfig) => void;
  private onUpdate?: () => void;
  private inspector: SoldierInspector;
  private isShop: boolean = false;
  private isCampaign: boolean = false;
  private isPrologue: boolean = false;
  private isStoreLocked: boolean = false;
  private isSquadSelectionLocked: boolean = false;
  private hasNodeSelected: boolean = false;
  private savedScrollTop: { left: number; center: number; right: number } = {
    left: 0,
    center: 0,
    right: 0,
  };
  private changeListener: () => void;

  constructor(
    containerId: string,
    manager: CampaignManager,
    modalService: ModalService,
    initialConfig: SquadConfig,
    onBack: (config: SquadConfig) => void,
    onUpdate?: () => void,
    onLaunch?: (config: SquadConfig) => void,
    isShop: boolean = false,
    isCampaign: boolean = false,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.modalService = modalService;
    this.config = JSON.parse(JSON.stringify(initialConfig)); // Deep copy (Vitest mock safe)
    if (!this.config.inventory) this.config.inventory = {};
    this.applyDefaults();
    this.onBack = onBack;
    this.onUpdate = onUpdate;
    this.onLaunch = onLaunch;
    this.isShop = isShop;
    this.isCampaign = isCampaign;

    this.changeListener = () => {
      if (this.container.style.display !== "none") {
        this.render();
      }
    };
    this.manager.addChangeListener(this.changeListener);

    this.inspector = new SoldierInspector({
      manager: this.manager,
      modalService: this.modalService,
      onUpdate: () => {
        this.onUpdateInternal();
      },
      onRecruit: () => {
        this.recruitMode = true;
        this.reviveMode = false;
        this.render();
        const first = this.container.querySelector(
          ".armory-panel .clickable:not(.disabled)",
        ) as HTMLElement;
        if (first) first.focus();
      },
      onRevive: () => {
        this.reviveMode = true;
        this.recruitMode = false;
        this.render();
        const first = this.container.querySelector(
          ".armory-panel .clickable:not(.disabled)",
        ) as HTMLElement;
        if (first) first.focus();
      },
    });
    this.inspector.setShop(this.isShop);
    this.inspector.setCampaign(this.isCampaign);
  }

  private onUpdateInternal() {
    FocusManager.saveFocus();
    this.render();
    FocusManager.restoreFocus(this.container);
    if (this.onUpdate) this.onUpdate();
  }

  public setShop(isShop: boolean) {
    this.isShop = isShop;
    this.inspector.setShop(isShop);
  }

  public setCampaign(isCampaign: boolean) {
    this.isCampaign = isCampaign;
    this.inspector.setCampaign(isCampaign);
  }

  public setPrologue(isPrologue: boolean) {
    this.isPrologue = isPrologue;
    this.render();
  }

  public setStoreLocked(locked: boolean) {
    this.isStoreLocked = locked;
    this.inspector.setLocked(locked);
    this.render();
  }

  public setSquadSelectionLocked(locked: boolean) {
    this.isSquadSelectionLocked = locked;
    this.render();
  }

  public setHasNodeSelected(hasNodeSelected: boolean) {
    this.hasNodeSelected = hasNodeSelected;
    this.render();
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
        { key: "Arrows", label: "Arrows", description: "Navigate UI", category: "Navigation" },
        { key: "Enter", label: "Enter", description: "Select / Equip", category: "Navigation" },
        { key: "ESC", label: "Esc", description: "Back to Setup", category: "Navigation" },
      ],
    });
  }

  private handleKeyDown(e: KeyboardEvent): boolean {
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      return UIUtils.handleArrowNavigation(e, this.container);
    }
    if (e.key === "Escape") {
      this.onBack(this.config);
      return true;
    }
    return false;
  }

  public updateConfig(config: SquadConfig) {
    this.config = JSON.parse(JSON.stringify(config));
    if (!this.config.inventory) this.config.inventory = {};
    this.applyDefaults();
    this.selectedSoldierIndex = 0;
    this.render();
  }

  private applyDefaults() {
    this.config.soldiers.forEach((soldier) => {
      const arch = ArchetypeLibrary[soldier.archetypeId];
      if (!arch) return;
      if (soldier.rightHand === undefined && arch.rightHand) soldier.rightHand = arch.rightHand;
      if (soldier.leftHand === undefined && arch.leftHand) soldier.leftHand = arch.leftHand;
      if (soldier.body === undefined && arch.body) soldier.body = arch.body;
      if (soldier.feet === undefined && arch.feet) soldier.feet = arch.feet;
    });
  }

  private autoAdvanceSlot() {
    for (let i = this.selectedSoldierIndex + 1; i < 4; i++) {
      if (!this.config.soldiers[i]) {
        this.selectedSoldierIndex = i;
        return;
      }
    }
  }

  public render() {

    const lastFocusId = document.activeElement?.getAttribute("data-focus-id");
    FocusManager.saveFocus();

    const oldLeft = this.container.querySelector(".soldier-list-panel .scroll-content");
    const oldCenter = this.container.querySelector(".soldier-equipment-panel .scroll-content");
    const oldRight = this.container.querySelector(".armory-panel .scroll-content");
    if (oldLeft) this.savedScrollTop.left = oldLeft.scrollTop;
    if (oldCenter) this.savedScrollTop.center = oldCenter.scrollTop;
    if (oldRight) this.savedScrollTop.right = oldRight.scrollTop;

    this.container.className = "screen equipment-screen flex-col h-full";
    this.container.style.display = "flex";
    this.container.style.overflow = "hidden";

    const isSlotEmpty = !this.config.soldiers[this.selectedSoldierIndex];
    let rightPanelTitle = "Logistics & Supplies";
    if (this.recruitMode) rightPanelTitle = "Procurement";
    else if (this.reviveMode) rightPanelTitle = "Integral Restoration";
    else if (isSlotEmpty) rightPanelTitle = "Asset Reserve";

    this.inspector.setSoldier(this.config.soldiers[this.selectedSoldierIndex]);

    const ui = (
      <Fragment>
        <div class="flex-row flex-grow p-10 gap-10 equipment-main-content" style={{ overflow: "hidden", minHeight: "0" }}>
          {/* Left Panel */}
          <div class="panel soldier-list-panel" style={{ width: "260px" }}>
            <h2 class="panel-title" style={{ flexShrink: "0" }}>Asset Roster</h2>
            <div class="scroll-content" style={{ padding: "10px" }}>
              {this.renderSoldierListItems()}
            </div>
          </div>

          {/* Center Panel */}
          <div class="panel soldier-equipment-panel" style={{ flexGrow: "1" }}>
            <h2 class="panel-title" style={{ flexShrink: "0" }}>Asset Loadout</h2>
            <div class="scroll-content" style={{ padding: "10px" }}>
              {this.inspector.renderDetails()}
            </div>
          </div>

          {/* Right Panel */}
          <div class="panel armory-panel roster-panel" style={{ width: "400px", display: "flex", flexDirection: "column" }}>
            <h2 class="panel-title" style={{ flexShrink: "0" }}>{rightPanelTitle}</h2>
            <div class="scroll-content roster-list" style={{ padding: "10px", flexGrow: "1", overflowY: "auto" }}>
              {this.renderRightPanelContent()}
            </div>
            {this.renderRightPanelActions()}
          </div>
        </div>

        <div class="flex-row justify-end p-10 gap-10" style={{ flexShrink: "0", borderTop: "1px solid var(--color-border-strong)", backgroundColor: "var(--color-surface-elevated)" }}>
          {(!this.isPrologue && (!this.isStoreLocked || this.isShop)) && (
            <button
              class="back-button"
              data-focus-id="btn-back"
              style={{ margin: "0", height: "32px", padding: "0 15px", fontSize: "0.9em", display: "flex", alignItems: "center" }}
              onClick={() => this.onBack(this.config)}
            >
              {this.isShop ? "Exit Hub" : "Back"}
            </button>
          )}
          {(this.isCampaign && this.hasNodeSelected && !this.isShop && this.onLaunch) && (
            <button
              class="primary-button"
              style={{
                background: "var(--color-hive)",
                borderColor: "var(--color-hive)",
                margin: "0",
                height: "32px",
                padding: "0 15px",
                fontSize: "0.9em",
                display: "flex",
                alignItems: "center",
                opacity: this.config.soldiers.filter(s => !!s).length === 0 ? 0.5 : 1
              }}
              data-focus-id="btn-launch-mission"
              disabled={this.config.soldiers.filter(s => !!s).length === 0}
              title={this.config.soldiers.filter(s => !!s).length === 0 ? "Assign at least one asset to authorize operation" : ""}
              onClick={() => this.onLaunch!(this.config)}
            >
              Authorize Operation
            </button>
          )}
        </div>
      </Fragment>
    );

    this.container.innerHTML = "";
    this.container.appendChild(ui);

    const newLeft = this.container.querySelector(".soldier-list-panel .scroll-content");
    const newCenter = this.container.querySelector(".soldier-equipment-panel .scroll-content");
    const newRight = this.container.querySelector(".armory-panel .scroll-content");
    if (newLeft) newLeft.scrollTop = this.savedScrollTop.left;
    if (newCenter) newCenter.scrollTop = this.savedScrollTop.center;
    if (newRight) newRight.scrollTop = this.savedScrollTop.right;

    if (!FocusManager.restoreFocus(this.container)) {
      if (lastFocusId && lastFocusId.startsWith("supply-plus-")) {
        const minusBtn = this.container.querySelector(`[data-focus-id="${lastFocusId.replace("plus", "minus")}"]`) as HTMLElement;
        if (minusBtn) minusBtn.focus();
      }
    }
  }

  private renderSoldierListItems() {
    const items = [];
    for (let i = 0; i < 4; i++) {
      const soldier = this.config.soldiers[i];
      if (soldier) {
        const item = SoldierWidget.render(soldier, {
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
        item.setAttribute("data-focus-id", `soldier-slot-${i}`);

        if (!this.isSquadSelectionLocked) {
          const removeBtn = (
            <button
              class="remove-soldier-btn slot-remove"
              data-focus-id={`remove-soldier-${i}`}
              tabindex="-1"
              title="De-allocate from Roster"
              onClick={(e: Event) => {
                e.stopPropagation();
                this.config.soldiers.splice(i, 1);
                this.render();
              }}
            >×</button>
          ) as HTMLElement;
          item.style.position = "relative";
          item.appendChild(removeBtn);
        }
        items.push(item);
      } else {
        const activeClass = this.selectedSoldierIndex === i ? "active" : "";
        const disabledClass = this.isSquadSelectionLocked ? "disabled" : "";
        items.push(
          <div
            class={`menu-item clickable ${activeClass} ${disabledClass}`}
            data-focus-id={`soldier-slot-${i}`}
            tabindex={this.isSquadSelectionLocked ? -1 : 0}
            style={{ marginBottom: "8px", padding: "8px 12px" }}
            onClick={() => {
              if (this.isSquadSelectionLocked) return;
              this.selectedSoldierIndex = i;
              this.recruitMode = false;
              this.reviveMode = false;
              this.render();
              const recruitBtn = this.container.querySelector('[data-focus-id="recruit-btn-large"]') as HTMLElement;
              if (recruitBtn) recruitBtn.focus();
              else {
                const firstRight = this.container.querySelector(".armory-panel .clickable:not(.disabled)") as HTMLElement;
                if (firstRight) firstRight.focus();
              }
            }}
            onKeyDown={(e: KeyboardEvent) => {
              if (!this.isSquadSelectionLocked && (e.key === "Enter" || e.key === " ")) {
                this.selectedSoldierIndex = i;
                this.recruitMode = false;
                this.reviveMode = false;
                this.render();
                e.preventDefault();
              }
            }}
          >
            <div style={{ fontWeight: "bold", color: this.selectedSoldierIndex === i ? "var(--color-primary)" : "var(--color-text-dim)", fontSize: "0.9em" }}>
              {i + 1}. [Empty Slot]
            </div>
            <div style={{ fontSize: "0.75em", color: "var(--color-text-muted)", marginTop: "2px" }}>
              {this.isSquadSelectionLocked ? "Slot Restricted" : "Click to Allocate Asset"}
            </div>
          </div>
        );
      }
    }
    return items;
  }

  private renderRightPanelContent() {
    const isSlotEmpty = !this.config.soldiers[this.selectedSoldierIndex];

    if (this.recruitMode) {
      return this.renderRecruitmentItems();
    } else if (this.reviveMode) {
      return this.renderReviveItems();
    } else if (isSlotEmpty) {
      return this.renderRosterPickerItems();
    } else {
      return this.renderRightPanelItems();
    }
  }

  private renderRightPanelActions() {
    if (!this.isCampaign || this.isShop) return null;
    if (this.recruitMode || this.reviveMode) return null;

    const state = this.manager.getState();
    if (!state || !state.roster) return null;

    // Persistent Recruit button to allow recruiting even when squad is full (regression_tkzi)
    if (state.roster.length < CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE) {
      return (
        <div class="roster-actions" style={{ padding: "10px", borderTop: "1px solid var(--color-border-strong)", backgroundColor: "var(--color-surface-elevated)" }}>
          <button
            class="menu-button w-full"
            data-focus-id="recruit-btn-large"
            disabled={state.scrap < 100}
            onClick={() => {
              this.recruitMode = true;
              this.reviveMode = false;
              this.render();
              const first = this.container.querySelector(
                ".armory-panel .clickable:not(.disabled)",
              ) as HTMLElement;
              if (first) first.focus();
            }}
          >
            <div class="btn-label">Acquire New Asset</div>
            <div class="btn-sub">Cost: 100 Credits</div>
          </button>
        </div>
      );
    }
    return null;
  }

  private renderRosterPickerItems() {
    const state = this.isCampaign ? this.manager.getState() : null;
    if (!state) return this.renderArchetypePickerItems();

    const squadIds = new Set(this.config.soldiers.map((s) => s.id).filter(Boolean));
    const available = state.roster.filter((s) => s.status === "Healthy" && !squadIds.has(s.id));

    if (available.length === 0) {
      return (
        <div class="flex-col align-center justify-center h-full" style={{ color: "var(--color-text-dim)", padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize: "2em", marginBottom: "10px" }}>📋</div>
          <div>No healthy assets available in roster.</div>
          <div style={{ fontSize: "0.8em", marginTop: "10px" }}>Acquire a new asset in the center panel.</div>
        </div>
      );
    }

    return available.map((soldier) => {
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
          this.autoAdvanceSlot();
          this.render();
        },
      });
      item.setAttribute("data-focus-id", `roster-${soldier.id}`);
      return item;
    });
  }

  private renderRecruitmentItems() {
    const state = this.isCampaign ? this.manager.getState() : null;
    if (!state) return null;

    const archetypes = state.unlockedArchetypes;
    const cost = 100;

    return archetypes.map((archId) => {
      const arch = ArchetypeLibrary[archId];
      if (!arch) return null;

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
            this.autoAdvanceSlot();
            this.render();
          }
        },
      });
      item.setAttribute("data-focus-id", `recruit-${archId}`);
      if (state.scrap < cost) {
        item.classList.add("disabled");
        item.style.opacity = "0.5";
        item.style.pointerEvents = "none";
      }
      return item;
    });
  }

  private renderReviveItems() {
    const state = this.isCampaign ? this.manager.getState() : null;
    if (!state) return null;

    const deadSoldiers = state.roster.filter((s) => s.status === "Dead");
    const cost = 250;

    if (deadSoldiers.length === 0) {
      return <div style={{ textAlign: "center", color: "var(--color-text-dim)", marginTop: "20px" }}>No deceased personnel available for revival.</div>;
    }

    return deadSoldiers.map((soldier) => {
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
            this.autoAdvanceSlot();
            this.render();
          }
        },
      });
      item.setAttribute("data-focus-id", `revive-${soldier.id}`);
      if (state.scrap < cost) {
        item.classList.add("disabled");
        item.style.opacity = "0.5";
        item.style.pointerEvents = "none";
      }
      return item;
    });
  }

  private renderArchetypePickerItems() {
    return Object.values(ArchetypeLibrary)
      .filter((arch) => arch.id !== "vip")
      .map((arch) => {
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
            this.autoAdvanceSlot();
            this.render();
          },
        });
        item.setAttribute("data-focus-id", `archetype-${arch.id}`);
        return item;
      });
  }

  private renderRightPanelItems() {
    const items = [];
    
    items.push(this.inspector.renderArmory());

    if (this.isStoreLocked) {
      items.push(
        <div class="locked-store-message" style={{ color: "var(--color-danger)", padding: "20px", textAlign: "center", border: "1px solid var(--color-danger)", borderRadius: "4px", marginTop: "20px" }}>
          <div style={{ fontSize: "1.5em", marginBottom: "10px" }}>🔒</div>
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Terminal Offline</div>
          <div style={{ fontSize: "0.8em", opacity: "0.8" }}>Maintenance diagnostics in progress. Standard equipment loadouts only.</div>
        </div>
      );
      return items;
    }

    items.push(
      <h3 style={{ color: "var(--color-primary)", borderBottom: "1px solid var(--color-border)", paddingBottom: "8px", margin: "20px 0 12px 0", fontSize: "1em", letterSpacing: "1px" }}>
        Global Supplies
      </h3>
    );

    const state = this.isCampaign ? this.manager.getState() : null;
    const unlockedItems = state?.unlockedItems || [];
    const basicSupplies = ["frag_grenade", "medkit", "mine"];
    const isUnlocked = (id: string) => !state || basicSupplies.includes(id) || unlockedItems.includes(id);

    Object.values(ItemLibrary).filter((i) => i.action && isUnlocked(i.id)).forEach((item) => {
      const count = (this.config.inventory && this.config.inventory[item.id]) || 0;
      items.push(
        <div class="flex-row justify-between align-center card w-full" style={{ marginBottom: "4px", padding: "6px 10px", gap: "8px" }} title={`${item.name}\n${item.description || ""}`}>
          <div class="flex-col" style={{ flexGrow: "1" }}>
            <div class="supply-item-header" style={{ fontWeight: "bold", fontSize: "0.85em", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span>{item.name}</span>
              <span style={{ color: "var(--color-primary)", fontSize: "0.8em", opacity: "0.8" }}>{state ? item.cost + " CR" : "Free"}</span>
            </div>
          </div>
          <div class="flex-row align-center gap-10">
            <button
              data-focus-id={`supply-minus-${item.id}`}
              style={{ padding: "2px 8px" }}
              onClick={() => {
                const current = (this.config.inventory && this.config.inventory[item.id]) || 0;
                if (current > 0) {
                  this.config.inventory[item.id] = current - 1;
                  this.render();
                }
              }}
            >-</button>
            <span style={{ minWidth: "20px", textAlign: "center" }}>{count}</span>
            <button
              data-focus-id={`supply-plus-${item.id}`}
              style={{ padding: "2px 8px" }}
              disabled={count >= 2}
              title={count >= 2 ? "Maximum 2 per mission reached" : ""}
              onClick={() => {
                const current = (this.config.inventory && this.config.inventory[item.id]) || 0;
                if (current < 2) {
                  const s = this.isCampaign ? this.manager.getState() : null;
                  if (s && s.scrap < item.cost) return;
                  if (s) this.manager.spendScrap(item.cost);
                  this.config.inventory[item.id] = current + 1;
                  this.render();
                }
              }}
            >+</button>
          </div>
        </div>
      );
    });

    return items;
  }
}
