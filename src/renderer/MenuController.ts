import {
  CommandType,
  EngagementPolicy,
  GameState,
  OverlayOption,
  UnitState,
  Vector2,
} from "../shared/types";

export type MenuState =
  | "ACTION_SELECT"
  | "TARGET_SELECT"
  | "UNIT_SELECT"
  | "MODE_SELECT";

export class MenuController {
  public menuState: MenuState = "ACTION_SELECT";
  public pendingAction: CommandType | null = null;
  public pendingMode: EngagementPolicy | null = null;
  public pendingLabel: string | null = null;
  public pendingTargetLocation: Vector2 | null = null;
  public overlayOptions: OverlayOption[] = [];

  constructor(private client: { sendCommand: (cmd: any) => void }) {}

  public reset() {
    this.menuState = "ACTION_SELECT";
    this.pendingAction = null;
    this.pendingMode = null;
    this.pendingLabel = null;
    this.pendingTargetLocation = null;
    this.overlayOptions = [];
  }

  public selectUnit(unitId: string) {
    if (this.menuState === "UNIT_SELECT" && this.pendingAction) {
      this.executePendingCommand([unitId]);
    }
  }

  public handleCanvasClick(cell: Vector2, gameState: GameState): void {
    if (
      this.menuState === "TARGET_SELECT" &&
      this.pendingAction === CommandType.MOVE_TO
    ) {
      this.pendingTargetLocation = cell;
      this.menuState = "UNIT_SELECT";
    }
  }

  public handleMenuInput(num: number, gameState: GameState): void {
    if (num === 0) {
      this.goBack();
      return;
    }
    if (this.menuState === "ACTION_SELECT") {
      if (num === 1) {
        // MOVE
        this.menuState = "TARGET_SELECT";
        this.pendingAction = CommandType.MOVE_TO;
        this.pendingLabel = "Moving";
        this.generateTargetOverlay("CELL", gameState);
      } else if (num === 2) {
        // STOP
        this.menuState = "UNIT_SELECT";
        this.pendingAction = CommandType.STOP;
        this.pendingLabel = "Stopping";
      } else if (num === 3) {
        // ENGAGEMENT
        this.menuState = "MODE_SELECT";
        this.pendingAction = CommandType.SET_ENGAGEMENT;
        this.pendingLabel = "Policy Change";
      } else if (num === 4) {
        // COLLECT
        this.menuState = "TARGET_SELECT";
        this.pendingAction = CommandType.MOVE_TO; // Collect is just Move To item
        this.pendingLabel = "Collecting";
        this.generateTargetOverlay("ITEM", gameState);
      } else if (num === 5) {
        // EXTRACT
        if (gameState.map.extraction) {
          this.pendingTargetLocation = gameState.map.extraction;
          this.menuState = "UNIT_SELECT";
          this.pendingAction = CommandType.MOVE_TO;
          this.pendingLabel = "Extracting";
        }
      } else if (num === 6) {
        // RESUME AI
        this.menuState = "UNIT_SELECT";
        this.pendingAction = CommandType.RESUME_AI;
        this.pendingLabel = "Resuming AI";
      }
    } else if (this.menuState === "MODE_SELECT") {
      if (num === 1) {
        this.pendingMode = "ENGAGE";
        this.menuState = "UNIT_SELECT";
      } else if (num === 2) {
        this.pendingMode = "IGNORE";
        this.menuState = "UNIT_SELECT";
      }
    } else if (this.menuState === "TARGET_SELECT") {
      const option = this.overlayOptions.find((o) => o.key === num.toString());
      if (option && option.pos) {
        this.pendingTargetLocation = option.pos;
        this.menuState = "UNIT_SELECT";
      }
    } else if (this.menuState === "UNIT_SELECT") {
      const activeUnits = gameState.units.filter(
        (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
      );
      let selectedIds: string[] = [];

      if (num > 0 && num <= activeUnits.length) {
        selectedIds = [activeUnits[num - 1].id];
      } else if (num === activeUnits.length + 1) {
        selectedIds = activeUnits.map((u) => u.id);
      }

      if (selectedIds.length > 0 && this.pendingAction) {
        this.executePendingCommand(selectedIds);
      }
    }
  }

  public goBack() {
    if (this.menuState === "UNIT_SELECT") {
      if (this.pendingAction === CommandType.SET_ENGAGEMENT)
        this.menuState = "MODE_SELECT";
      else if (this.pendingAction === CommandType.MOVE_TO)
        this.menuState = "TARGET_SELECT";
      else this.menuState = "ACTION_SELECT";
    } else if (
      this.menuState === "MODE_SELECT" ||
      this.menuState === "TARGET_SELECT"
    ) {
      this.menuState = "ACTION_SELECT";
    }

    if (this.menuState === "ACTION_SELECT") {
      this.reset();
    }
  }

  public getMenuHtml(): string {
    let menuHtml = "";
    if (this.menuState === "ACTION_SELECT") {
      menuHtml = `<h3>ACTIONS</h3>`;
      menuHtml += `
            <div class="menu-item clickable" data-index="1" data-cmd="MOVE">1. MOVE</div>
            <div class="menu-item clickable" data-index="2" data-cmd="STOP">2. STOP</div>
            <div class="menu-item clickable" data-index="3" data-cmd="ENGAGEMENT">3. ENGAGEMENT</div>
            <div class="menu-item clickable" data-index="4" data-cmd="COLLECT">4. COLLECT</div>
            <div class="menu-item clickable" data-index="5" data-cmd="EXTRACT">5. EXTRACT</div>
            <div class="menu-item clickable" data-index="6" data-cmd="RESUME">6. RESUME AI</div>
            <p style="color:#888; font-size:0.8em; margin-top:10px;">(Select Action)</p>
          `;
    } else if (this.menuState === "MODE_SELECT") {
      menuHtml = `<h3>SELECT MODE</h3>`;
      menuHtml += `
            <div class="menu-item clickable" data-index="1" data-mode="ENGAGE">1. ENGAGE (Stop and Shoot)</div>
            <div class="menu-item clickable" data-index="2" data-mode="IGNORE">2. IGNORE (Run)</div>
            <div class="menu-item clickable" data-index="0" style="color: #ffaa00; margin-top: 10px;">0. BACK</div>
            <p style="color:#888; font-size:0.8em; margin-top:10px;">(ESC to Go Back)</p>
          `;
    } else if (this.menuState === "TARGET_SELECT") {
      menuHtml = `<h3>SELECT TARGET</h3>`;
      if (
        this.overlayOptions.length === 0 &&
        this.pendingAction !== CommandType.MOVE_TO
      ) {
        menuHtml += `<p style="color:#f00;">No POIs available.</p>`;
      } else {
        this.overlayOptions.forEach((opt) => {
          menuHtml += `<div class="menu-item clickable" data-index="${opt.key}" data-key="${opt.key}">${opt.key}. ${opt.label}</div>`;
        });
      }
      menuHtml += `<div class="menu-item clickable" data-index="0" style="color: #ffaa00; margin-top: 10px;">0. BACK</div>`;
      menuHtml += `<p style="color:#888; font-size:0.8em; margin-top:10px;">(Click map or press 1-9)</p>`;
    } else if (this.menuState === "UNIT_SELECT") {
      menuHtml = `<h3>SELECT UNIT(S)</h3>`;
      // Note: Unit list rendering is dynamic based on state, but we don't have state here easily unless passed.
      // But we can return a placeholder or generic instruction,
      // OR we rely on main.ts to render the unit list part?
      // Actually, main.ts renders the *Soldier Panel* (RPG style), but also a *Unit Selection Menu* in the right panel.
      // Let's assume the caller will handle the unit list in the menu if they want, OR we pass state to getMenuHtml.
      // But getMenuHtml is usually called without state in main.ts loop?
      // Wait, main.ts uses state in the loop.
      // So we should pass state here too, or keep it generic?
      // main.ts did:
      /*
            let counter = 1;
            const activeUnits = state.units.filter...
            activeUnits.forEach...
            */
      // So we definitely need state.
      menuHtml += `<p class="error">State required for Unit Select</p>`;
    }
    return menuHtml;
  }

  // Overloaded for stateful rendering
  public getMenuHtmlWithState(gameState: GameState): string {
    if (this.menuState === "UNIT_SELECT") {
      let menuHtml = `<h3>SELECT UNIT(S)</h3>`;
      let counter = 1;
      const activeUnits = gameState.units.filter(
        (u) => u.state !== UnitState.Dead && u.state !== UnitState.Extracted,
      );
      activeUnits.forEach((u) => {
        menuHtml += `<div class="menu-item clickable" data-index="${counter}" data-unit-id="${u.id}">${counter}. Unit ${u.id}</div>`;
        counter++;
      });
      menuHtml += `<div class="menu-item clickable" data-index="${counter}" data-unit-id="ALL">${counter}. ALL UNITS</div>`;
      menuHtml += `<div class="menu-item clickable" data-index="0" style="color: #ffaa00; margin-top: 10px;">0. BACK</div>`;
      menuHtml += `<p style="color:#888; font-size:0.8em; margin-top:10px;">(Press 1-9 or ESC)</p>`;
      return menuHtml;
    }
    return this.getMenuHtml();
  }

  private executePendingCommand(unitIds: string[]) {
    if (!this.pendingAction) return;

    if (
      this.pendingAction === CommandType.MOVE_TO &&
      this.pendingTargetLocation
    ) {
      this.client.sendCommand({
        type: CommandType.MOVE_TO,
        unitIds,
        target: this.pendingTargetLocation,
        label: this.pendingLabel || undefined,
      });
    } else if (this.pendingAction === CommandType.STOP) {
      this.client.sendCommand({
        type: CommandType.STOP,
        unitIds,
        label: this.pendingLabel || undefined,
      });
    } else if (
      this.pendingAction === CommandType.SET_ENGAGEMENT &&
      this.pendingMode
    ) {
      this.client.sendCommand({
        type: CommandType.SET_ENGAGEMENT,
        unitIds,
        mode: this.pendingMode,
        label: this.pendingLabel || undefined,
      });
    } else if (this.pendingAction === CommandType.RESUME_AI) {
      this.client.sendCommand({
        type: CommandType.RESUME_AI,
        unitIds,
        label: this.pendingLabel || undefined,
      });
    }

    this.reset();
  }

  private generateTargetOverlay(type: "CELL" | "ITEM", gameState: GameState) {
    this.overlayOptions = [];
    let counter = 1;

    if (type === "ITEM") {
      gameState.objectives.forEach((obj) => {
        if (obj.state === "Pending" && obj.visible && obj.targetCell) {
          this.overlayOptions.push({
            key: counter.toString(),
            label: `Collect ${obj.kind}`,
            pos: obj.targetCell,
          });
          counter++;
        }
      });
    } else if (type === "CELL") {
      if (gameState.map.extraction) {
        this.overlayOptions.push({
          key: counter.toString(),
          label: "Extraction",
          pos: gameState.map.extraction,
        });
        counter++;
      }
      gameState.objectives.forEach((obj) => {
        if (obj.state === "Pending" && obj.visible && obj.targetCell) {
          this.overlayOptions.push({
            key: counter.toString(),
            label: `Obj ${obj.id}`,
            pos: obj.targetCell,
          });
          counter++;
        }
      });
    }
  }
}
