import { GameClient } from "@src/engine/GameClient";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { MenuController } from "../MenuController";
import { HUDManager } from "../ui/HUDManager";
import { InputManager } from "../InputManager";
import { InputDispatcher } from "../InputDispatcher";
import { TooltipManager } from "../ui/TooltipManager";
import { ModalService } from "../ui/ModalService";
import type { CampaignTabId } from "../ui/CampaignShell";
import { CampaignShell } from "../ui/CampaignShell";
import type { CloudSyncService } from "@src/services/CloudSyncService";
import { TutorialManager } from "../controllers/TutorialManager";
import { AdvisorOverlay } from "../ui/AdvisorOverlay";
import type { ScreenId } from "../ScreenManager";
import { ScreenManager } from "../ScreenManager";
import { SaveManager } from "@src/services/SaveManager";
import { LocalStorageProvider } from "@src/engine/persistence/LocalStorageProvider";
import { AssetManager } from "../visuals/AssetManager";
import { ConfigManager } from "../ConfigManager";
import { Logger, LogLevel } from "@src/shared/Logger";
import { MapFactory } from "@src/engine/map/MapFactory";
import type { MapGenerationConfig, GameState, Unit } from "@src/shared/types";
import type { Renderer as IRenderer } from "../Renderer";
import { MissionSetupManager } from "./MissionSetupManager";
import { MissionCoordinator } from "./MissionCoordinator";
import { MissionRunner } from "./MissionRunner";
import { InputOrchestrator } from "./InputOrchestrator";
import type { NavigationScreens } from "./NavigationOrchestrator";
import { NavigationOrchestrator } from "./NavigationOrchestrator";
import type { SquadBuilder } from "../components/SquadBuilder";
import { UIOrchestrator } from "./UIOrchestrator";

export interface AppServiceRegistryConfig {
  onScreenChange: (id: ScreenId, isCampaign: boolean) => void;
  onShellTabChange: (tabId: CampaignTabId) => void;
  onShellMainMenu: () => void;
  onUnitClick: (unit: Unit | null, shift?: boolean) => void;
  onAbortMission: () => void;
  onMenuInput: (key: string, shift?: boolean) => void;
  onTimeScaleChange: (scale: number) => void;
  onCopyWorldState: () => void;
  onDebugForceWin: () => void;
  onDebugForceLose: () => void;
  onStartMission: () => void;
  onDeployUnit: (unitId: string, x: number, y: number) => void;
  onUndeployUnit: (unitId: string) => void;
  onTogglePause: () => void;
  onToggleDebug: (enabled: boolean) => void;
  onToggleLos: (enabled: boolean) => void;
  onForceWin: () => void;
  onForceLose: () => void;
  onCanvasClick: (e: MouseEvent) => void;
  onRendererCreated: (renderer: IRenderer) => void;
  getCurrentGameState: () => GameState | null;
  isDebriefVisible: () => boolean;
  getSelectedUnitId: () => string | null;
  getCellCoordinates: (px: number, py: number) => { x: number; y: number };
  getWorldCoordinates: (px: number, py: number) => { x: number; y: number };
  cycleUnits: (reverse?: boolean) => void;
  panMap: (direction: string) => void;
  panMapBy: (dx: number, dy: number) => void;
  zoomMap: (ratio: number, cx: number, cy: number) => void;
  getRenderer: () => IRenderer | null;
}

export class AppServiceRegistry {
  public gameClient!: GameClient;
  public campaignManager!: CampaignManager;
  public metaManager!: MetaManager;
  public themeManager!: ThemeManager;
  public assetManager!: AssetManager;
  public menuController!: MenuController;
  public hudManager!: HUDManager;
  public inputManager!: InputManager;
  public inputDispatcher!: InputDispatcher;
  public tooltipManager!: TooltipManager;
  public modalService!: ModalService;
  public campaignShell!: CampaignShell;
  public cloudSync!: CloudSyncService;
  public tutorialManager!: TutorialManager;
  public advisorOverlay!: AdvisorOverlay;
  public screenManager!: ScreenManager;
  public missionSetupManager!: MissionSetupManager;
  public missionCoordinator!: MissionCoordinator;
  public missionRunner!: MissionRunner;
  public inputOrchestrator!: InputOrchestrator;
  public navigationOrchestrator!: NavigationOrchestrator;
  public uiOrchestrator!: UIOrchestrator;

  public destroy() {
    if (this.inputDispatcher) this.inputDispatcher.destroy();
    if (this.tooltipManager) this.tooltipManager.destroy();
    if (this.missionRunner) this.missionRunner.stop();
  }

  public async initialize(config: AppServiceRegistryConfig) {
    // 1. Initialize core managers
    const globalConfig = ConfigManager.loadGlobal();
    Logger.setLevel(LogLevel[globalConfig.logLevel]);

    this.themeManager = new ThemeManager();
    await this.themeManager.init();
    
    this.assetManager = new AssetManager(this.themeManager);
    this.assetManager.loadSprites();
    
    this.inputDispatcher = new InputDispatcher();
    
    const saveManager = new SaveManager();
    saveManager.getCloudSync().setEnabled(globalConfig.cloudSyncEnabled);
    this.metaManager = new MetaManager(new LocalStorageProvider());
    this.campaignManager = new CampaignManager(saveManager, this.metaManager);

    // Initialize cloudSync from SaveManager
    this.cloudSync = saveManager.getCloudSync();
    await this.cloudSync.initialize();

    this.campaignManager.load();
    this.tooltipManager = new TooltipManager();
    this.modalService = new ModalService(this.inputDispatcher);
    this.screenManager = new ScreenManager(config.onScreenChange);

    this.campaignShell = new CampaignShell({
      containerId: "screen-campaign-shell",
      manager: this.campaignManager,
      metaManager: this.metaManager,
      inputDispatcher: this.inputDispatcher,
      onTabChange: config.onShellTabChange,
      onMenu: config.onShellMainMenu,
    });

    const mapGeneratorFactory = (mapConfig: MapGenerationConfig): MapFactory => {
      return new MapFactory(mapConfig);
    };
    this.gameClient = new GameClient((mapConfig) =>
      mapGeneratorFactory(mapConfig),
    );
    this.menuController = new MenuController(this.gameClient);
    
    this.uiOrchestrator = new UIOrchestrator({
      gameClient: this.gameClient,
      modalService: this.modalService,
      getCurrentGameState: () => config.getCurrentGameState(),
    });

    this.advisorOverlay = new AdvisorOverlay(
      this.gameClient,
      this.themeManager,
      this.inputDispatcher,
    );
    this.tutorialManager = new TutorialManager({
      gameClient: this.gameClient,
      campaignManager: this.campaignManager,
      menuController: this.menuController,
      onMessage: (msg, onDismiss) => {
        this.advisorOverlay.showMessage(msg, onDismiss);
      },
      getRenderer: () => config.getRenderer(),
    });
    this.menuController.setTutorialManager(this.tutorialManager);
    this.tutorialManager.enable();

    this.missionSetupManager = new MissionSetupManager(
      this.campaignManager,
      this.themeManager,
      this.modalService,
    );

    this.missionCoordinator = new MissionCoordinator({
      campaignShell: this.campaignShell,
      gameClient: this.gameClient,
      screenManager: this.screenManager,
      menuController: this.menuController,
      campaignManager: this.campaignManager,
      themeManager: this.themeManager,
      assetManager: this.assetManager,
      onRendererCreated: (renderer: IRenderer) => config.onRendererCreated(renderer),
    });

    // 2. Initialize UI managers
    this.hudManager = new HUDManager({
      menuController: this.menuController,
      tutorialManager: this.tutorialManager,
      onUnitClick: config.onUnitClick,
      onAbortMission: config.onAbortMission,
      onMenuInput: config.onMenuInput,
      onCopyWorldState: config.onCopyWorldState,
      onForceWin: config.onForceWin,
      onForceLose: config.onForceLose,
      onStartMission: config.onStartMission,
      onDeployUnit: config.onDeployUnit,
    });

    this.missionRunner = new MissionRunner({
      missionCoordinator: this.missionCoordinator,
      missionSetupManager: this.missionSetupManager,
      gameClient: this.gameClient,
      campaignManager: this.campaignManager,
      hudManager: this.hudManager,
      menuController: this.menuController,
      modalService: this.modalService,
      uiOrchestrator: this.uiOrchestrator,
    });

    this.inputOrchestrator = new InputOrchestrator({
      gameClient: this.gameClient,
      menuController: this.menuController,
      hudManager: this.hudManager,
      missionRunner: this.missionRunner,
      getRenderer: config.getRenderer,
      isTutorialPassive: () => this.tutorialManager.isProloguePassiveStep(),
    });

    this.inputManager = new InputManager({
      screenManager: this.screenManager,
      menuController: this.menuController,
      inputDispatcher: this.inputDispatcher,
      togglePause: config.onTogglePause,
      handleMenuInput: (key, shift) => this.inputOrchestrator.handleMenuInput(key, shift),
      abortMission: config.onAbortMission,
      onUnitDeselect: () => this.inputOrchestrator.onUnitClick(null, false),
      handleCanvasClick: (e) => this.inputOrchestrator.handleCanvasClick(e),
      onToggleDebug: config.onToggleDebug,
      onToggleLos: config.onToggleLos,
      currentGameState: () => this.missionRunner.getCurrentGameState(),
      isDebriefing: config.isDebriefVisible,
      getSelectedUnitId: config.getSelectedUnitId,
      onDeployUnit: config.onDeployUnit,
      onUndeployUnit: config.onUndeployUnit,
      getCellCoordinates: config.getCellCoordinates,
      getWorldCoordinates: config.getWorldCoordinates,
      cycleUnits: (reverse) => this.inputOrchestrator.cycleUnits(reverse),
      panMap: (direction) => this.inputOrchestrator.panMap(direction),
      panMapBy: (dx, dy) => this.inputOrchestrator.panMapBy(dx, dy),
      zoomMap: (ratio, cx, cy) => this.inputOrchestrator.zoomMap(ratio, cx, cy),
    });
    this.inputManager.init();
  }

  public finalizeNavigation(
    screens: NavigationScreens,
    squadBuilder: SquadBuilder,
    callbacks: {
      showMainMenu: () => void;
    }
  ) {
    this.navigationOrchestrator = new NavigationOrchestrator({
      screenManager: this.screenManager,
      campaignShell: this.campaignShell,
      campaignManager: this.campaignManager,
      themeManager: this.themeManager,
      modalService: this.modalService,
      missionSetupManager: this.missionSetupManager,
      squadBuilder,
      screens,
      tutorialManager: this.tutorialManager,
      callbacks: {
        showMainMenu: callbacks.showMainMenu,
        launchMission: () => this.missionRunner.launchMission(),
        resumeMission: () => this.missionRunner.resumeMission(),
      },
    });

    this.missionRunner.setNavigationOrchestrator(this.navigationOrchestrator);
  }
}
