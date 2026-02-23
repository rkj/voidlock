import { GameState, MissionType } from "@src/shared/types";
import { MissionReport } from "@src/shared/campaign_types";
import { MissionCoordinator } from "./MissionCoordinator";
import { MissionSetupManager } from "./MissionSetupManager";
import { NavigationOrchestrator } from "./NavigationOrchestrator";
import { UIOrchestrator } from "./UIOrchestrator";
import { GameClient } from "@src/engine/GameClient";
import { CampaignManager } from "../campaign/CampaignManager";
import { HUDManager } from "../ui/HUDManager";
import { MenuController } from "../MenuController";
import { Logger } from "@src/shared/Logger";
import { ModalService } from "../ui/ModalService";
import prologueMap from "@src/content/maps/prologue.json";

export interface MissionRunnerDependencies {
  missionCoordinator: MissionCoordinator;
  missionSetupManager: MissionSetupManager;
  navigationOrchestrator?: NavigationOrchestrator;
  uiOrchestrator?: UIOrchestrator;
  gameClient: GameClient;
  campaignManager: CampaignManager;
  hudManager: HUDManager;
  menuController: MenuController;
  modalService: ModalService;
}

export class MissionRunner {
  private currentGameState: GameState | null = null;
  private selectedUnitId: string | null = null;
  private navigationOrchestrator!: NavigationOrchestrator;
  private uiOrchestrator!: UIOrchestrator;

  constructor(private deps: MissionRunnerDependencies) {
    if (deps.navigationOrchestrator) {
      this.navigationOrchestrator = deps.navigationOrchestrator;
    }
    if (deps.uiOrchestrator) {
      this.uiOrchestrator = deps.uiOrchestrator;
    }
  }

  public setNavigationOrchestrator(nav: NavigationOrchestrator) {
    this.navigationOrchestrator = nav;
  }

  public setUIOrchestrator(ui: UIOrchestrator) {
    this.uiOrchestrator = ui;
  }

  public getSelectedUnitId(): string | null {
    return this.selectedUnitId;
  }

  public setSelectedUnitId(id: string | null) {
    this.selectedUnitId = id;
  }

  public getCurrentGameState(): GameState | null {
    return this.currentGameState;
  }

  public launchMission() {
    this.uiOrchestrator.setMissionHUDVisible(true);
    this.navigationOrchestrator.switchScreen("mission", false, false);

    const config = this.deps.missionSetupManager.saveCurrentConfig();

    // Handle Prologue Map (ADR 0042)
    let staticMapData = this.deps.missionSetupManager.currentStaticMapData;
    if (config.missionType === MissionType.Prologue) {
      staticMapData = prologueMap as any;
    }

    this.deps.missionCoordinator.launchMission(
      {
        ...config,
        seed: config.lastSeed,
        staticMapData,
        campaignNode: this.deps.missionSetupManager.currentCampaignNode || undefined,
        skipDeployment: !this.deps.missionSetupManager.manualDeployment || config.missionType === MissionType.Prologue,
        debugSnapshotInterval: config.debugSnapshotInterval || 0,
      },
      (report) => {
        this.onMissionComplete(report);
        return true;
      },
      (state) => this.updateUI(state),
      () => this.syncSpeedUI(),
    );
  }

  public resumeMission() {
    this.uiOrchestrator.setMissionHUDVisible(true);
    this.navigationOrchestrator.switchScreen("mission", false, false);

    this.deps.missionCoordinator.resumeMission(
      (report) => {
        this.onMissionComplete(report);
        return true;
      },
      (state) => this.updateUI(state),
      () => this.syncSpeedUI(),
      (node) => {
        this.deps.missionSetupManager.currentCampaignNode = node;
        if (node) this.navigationOrchestrator.applyCampaignTheme();
      },
    );
  }

  public async abortMission() {
    const confirmed = await this.deps.modalService.confirm(
      "Abort Mission and return to menu?",
    );
    if (!confirmed) return;

    this.deps.missionCoordinator.abortMission(
      this.currentGameState,
      this.deps.missionSetupManager.currentCampaignNode,
      this.deps.missionSetupManager.currentSeed,
      this.deps.missionSetupManager.currentSquad,
      (report) => {
        this.onMissionComplete(report);
      },
    );
  }

  private onMissionComplete(report: MissionReport) {
    Logger.info("Mission Complete!", report);

    // Update campaign state via manager
    if (report.nodeId !== "custom") {
      this.deps.campaignManager.processMissionResult(report);
    }

    const replayData = this.deps.gameClient.getReplayData();

    // Show debrief screen
    this.navigationOrchestrator.switchScreen(
      "debrief",
      false,
      true,
      report,
      replayData?.unitStyle || this.deps.missionSetupManager.unitStyle,
    );
  }

  public updateUI(state: GameState) {
    this.currentGameState = state;
    this.deps.hudManager.update(state, this.selectedUnitId);
    this.deps.menuController.update(state);
  }

  public syncSpeedUI() {
    this.uiOrchestrator.syncSpeedUI();
  }

  public setMissionHUDVisible(visible: boolean) {
    this.uiOrchestrator.setMissionHUDVisible(visible);
  }
}
