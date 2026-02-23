import { GameClient } from "@src/engine/GameClient";
import { MenuController } from "../MenuController";
import { HUDManager } from "../ui/HUDManager";
import { MissionRunner } from "./MissionRunner";
import { Renderer } from "../Renderer";
import { Unit, UnitState, CommandType } from "@src/shared/types";
import { MathUtils } from "@src/shared/utils/MathUtils";

export interface InputOrchestratorConfig {
  gameClient: GameClient;
  menuController: MenuController;
  hudManager: HUDManager;
  missionRunner: MissionRunner;
  getRenderer: () => Renderer | null;
}

/**
 * InputOrchestrator consolidates tactical input handling (pan, zoom, cycle units, canvas click).
 * It delegates to specialized managers but owns the high-level orchestration of tactical input.
 */
export class InputOrchestrator {
  private gameClient: GameClient;
  private menuController: MenuController;
  private hudManager: HUDManager;
  private missionRunner: MissionRunner;
  private getRenderer: () => Renderer | null;

  constructor(config: InputOrchestratorConfig) {
    this.gameClient = config.gameClient;
    this.menuController = config.menuController;
    this.hudManager = config.hudManager;
    this.missionRunner = config.missionRunner;
    this.getRenderer = config.getRenderer;
  }

  public handleMenuInput(key: string, shiftHeld: boolean = false) {
    const state = this.missionRunner.getCurrentGameState();
    if (!state) return;
    this.menuController.isShiftHeld = shiftHeld;
    this.menuController.handleMenuInput(key, state);
    this.missionRunner.updateUI(state);
  }

  public cycleUnits(reverse: boolean = false) {
    const state = this.missionRunner.getCurrentGameState();
    if (!state) return;
    const units = state.units;
    if (units.length === 0) return;

    let index = units.findIndex((u) => u.id === this.missionRunner.getSelectedUnitId());
    if (reverse) {
      index = index <= 0 ? units.length - 1 : index - 1;
    } else {
      index = index === -1 || index >= units.length - 1 ? 0 : index + 1;
    }

    const unitId = units[index].id;
    this.missionRunner.setSelectedUnitId(unitId);
    this.centerOnUnit(unitId);
  }

  public centerOnUnit(unitId: string) {
    const state = this.missionRunner.getCurrentGameState();
    const renderer = this.getRenderer();
    if (!state || !renderer) return;
    const unit = state.units.find((u) => u.id === unitId);
    if (unit) {
      const cellSize = renderer.cellSize;
      const container = document.getElementById("game-container");
      if (container) {
        container.scrollTo({
          left: unit.pos.x * cellSize - container.clientWidth / 2,
          top: unit.pos.y * cellSize - container.clientHeight / 2,
          behavior: "smooth",
        });
      }
    }
  }

  public panMap(direction: string) {
    const container = document.getElementById("game-container");
    if (!container) return;
    const panAmount = 100;
    switch (direction) {
      case "up": container.scrollTop -= panAmount; break;
      case "down": container.scrollTop += panAmount; break;
      case "left": container.scrollLeft -= panAmount; break;
      case "right": container.scrollLeft += panAmount; break;
    }
  }

  public panMapBy(dx: number, dy: number) {
    const container = document.getElementById("game-container");
    if (!container) return;
    container.scrollLeft += dx;
    container.scrollTop += dy;
  }

  public zoomMap(ratio: number, centerX: number, centerY: number) {
    const renderer = this.getRenderer();
    if (!renderer) return;
    const container = document.getElementById("game-container");
    if (!container) return;

    const oldCellSize = renderer.cellSize;
    const newCellSize = Math.max(32, Math.min(512, oldCellSize * ratio));
    if (newCellSize === oldCellSize) return;

    const rect = container.getBoundingClientRect();
    const localCX = centerX - rect.left;
    const localCY = centerY - rect.top;
    const scrollX = container.scrollLeft;
    const scrollY = container.scrollTop;
    const actualRatio = newCellSize / oldCellSize;

    renderer.setCellSize(newCellSize);
    const state = this.missionRunner.getCurrentGameState();
    if (state) {
      renderer.render(state);
    }

    container.scrollLeft = (scrollX + localCX) * actualRatio - localCX;
    container.scrollTop = (scrollY + localCY) * actualRatio - localCY;
  }

  public onUnitClick(unit: Unit | null, shiftHeld: boolean = false) {
    if (!unit) {
      this.missionRunner.setSelectedUnitId(null);
      const state = this.missionRunner.getCurrentGameState();
      if (state) this.hudManager.update(state, null);
      return;
    }

    if (this.menuController.menuState === "UNIT_SELECT") {
      this.menuController.selectUnit(unit.id);
      const state = this.missionRunner.getCurrentGameState();
      if (state) this.hudManager.update(state, this.missionRunner.getSelectedUnitId());
      return;
    }

    if (this.missionRunner.getSelectedUnitId() !== unit.id) {
      this.menuController.reset();
    }

    this.missionRunner.setSelectedUnitId(unit.id);
    if (!shiftHeld) {
      this.centerOnUnit(unit.id);
    }
  }

  public handleCanvasClick(event: MouseEvent) {
    const renderer = this.getRenderer();
    if (!renderer) return;
    const state = this.missionRunner.getCurrentGameState();
    if (!state) return;

    const clickedCell = renderer.getCellCoordinates(event.clientX, event.clientY);

    if (state.status === "Deployment") {
      if (event.button === 2) {
        const unit = state.units.find((u) => MathUtils.sameCellPosition(u.pos, clickedCell) && u.isDeployed !== false);
        if (unit && unit.archetypeId !== "vip") {
          this.gameClient.applyCommand({ type: CommandType.UNDEPLOY_UNIT, unitId: unit.id });
        }
        return;
      }

      if (event.button === 0 && this.missionRunner.getSelectedUnitId()) {
        const unit = state.units.find((u) => u.id === this.missionRunner.getSelectedUnitId());
        if (unit && unit.archetypeId !== "vip") {
          const isValidSpawn = state.map.squadSpawns?.some((s) => s.x === clickedCell.x && s.y === clickedCell.y) ||
            (state.map.squadSpawn && state.map.squadSpawn.x === clickedCell.x && state.map.squadSpawn.y === clickedCell.y);

          if (isValidSpawn) {
            this.gameClient.applyCommand({
              type: CommandType.DEPLOY_UNIT,
              unitId: unit.id,
              target: { x: clickedCell.x + 0.5, y: clickedCell.y + 0.5 },
            });
            return;
          }
        }
      }
    }

    const prevState = this.menuController.menuState;
    this.menuController.handleCanvasClick(clickedCell, state);

    if (this.menuController.menuState !== prevState) {
      this.missionRunner.updateUI(state);
      return;
    }

    const unitAtClick = state.units.find((u) => 
      MathUtils.sameCellPosition(u.pos, clickedCell) && 
      u.state !== UnitState.Dead && 
      u.state !== UnitState.Extracted && 
      u.isDeployed !== false
    );
    if (unitAtClick) this.onUnitClick(unitAtClick);
  }
}
