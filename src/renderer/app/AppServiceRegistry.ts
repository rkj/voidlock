import { GameClient } from "@src/engine/GameClient";
import { CampaignManager } from "../campaign/CampaignManager";
import { MetaManager } from "../campaign/MetaManager";
import { ThemeManager } from "../ThemeManager";
import { MenuController } from "../MenuController";
import { HUDManager } from "../ui/HUDManager";
import { InputManager } from "../InputManager";
import { ModalService } from "../ui/ModalService";
import { CampaignShell, CampaignTabId } from "../ui/CampaignShell";
import { CloudSyncService } from "@src/services/CloudSyncService";
import { TutorialManager } from "../controllers/TutorialManager";
import { AdvisorOverlay } from "../ui/AdvisorOverlay";
import { ScreenManager, ScreenId } from "../ScreenManager";
import { SaveManager } from "@src/services/SaveManager";
import { AssetManager } from "../visuals/AssetManager";
import { ConfigManager } from "../ConfigManager";
import { Logger, LogLevel } from "@src/shared/Logger";
import { MapFactory } from "@src/engine/map/MapFactory";
import { MapGenerationConfig, GameState, Unit } from "@src/shared/types";
import { Renderer as IRenderer } from "../Renderer";
import { MissionSetupManager } from "./MissionSetupManager";
import { MissionCoordinator } from "./MissionCoordinator";
import { MissionRunner } from "./MissionRunner";
import { NavigationOrchestrator, NavigationScreens } from "./NavigationOrchestrator";
import { SquadBuilder } from "../components/SquadBuilder";

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
  onCanvasClick: (e: MouseEvent) => void;
  onRendererCreated: (renderer: IRenderer) => void;
  getCurrentGameState: () => GameState | null;
  isDebriefVisible: () => boolean;
  getSelectedUnitId: () => string | null;
  getCellCoordinates: (px: number, py: number) => { x: number; y: number };
  cycleUnits: (reverse?: boolean) => void;
  panMap: (direction: string) => void;
  panMapBy: (dx: number, dy: number) => void;
  zoomMap: (ratio: number, cx: number, cy: number) => void;
}

export class AppServiceRegistry {
  public gameClient!: GameClient;
  public campaignManager!: CampaignManager;
  public metaManager!: MetaManager;
  public themeManager!: ThemeManager;
  public menuController!: MenuController;
  public hudManager!: HUDManager;
  public inputManager!: InputManager;
  public modalService!: ModalService;
  public campaignShell!: CampaignShell;
  public cloudSync!: CloudSyncService;
  public tutorialManager!: TutorialManager;
  public advisorOverlay!: AdvisorOverlay;
  public screenManager!: ScreenManager;
  public missionSetupManager!: MissionSetupManager;
  public missionCoordinator!: MissionCoordinator;
  public missionRunner!: MissionRunner;
  public navigationOrchestrator!: NavigationOrchestrator;

  public async initialize(config: AppServiceRegistryConfig) {
    // 1. Initialize core managers
    const globalConfig = ConfigManager.loadGlobal();
    Logger.setLevel(LogLevel[globalConfig.logLevel as keyof typeof LogLevel]);

    this.themeManager = ThemeManager.getInstance();
    await this.themeManager.init();
    
    // Ensure sprites are loaded now that the asset manifest is available
    AssetManager.getInstance().loadSprites();
    
    this.campaignManager = CampaignManager.getInstance();
    this.metaManager = MetaManager.getInstance();

    // Initialize cloudSync from SaveManager
    const storage = this.campaignManager.getStorage();
    if (storage instanceof SaveManager) {
      this.cloudSync = storage.getCloudSync();
      await this.cloudSync.initialize();
    }

    await this.campaignManager.load();
    this.modalService = new ModalService();
    this.screenManager = new ScreenManager(config.onScreenChange);

    this.campaignShell = new CampaignShell(
      "screen-campaign-shell",
      this.campaignManager,
      this.metaManager,
      config.onShellTabChange,
      config.onShellMainMenu,
    );

    const mapGeneratorFactory = (config: MapGenerationConfig): MapFactory => {
      return new MapFactory(config);
    };
    this.gameClient = new GameClient((config) =>
      mapGeneratorFactory(config),
    );
    this.menuController = new MenuController(this.gameClient);
    
    this.advisorOverlay = new AdvisorOverlay(this.gameClient);
    this.tutorialManager = new TutorialManager(this.gameClient, (msg) => {
        this.advisorOverlay.showMessage(msg);
    });
    this.tutorialManager.enable();

    this.missionSetupManager = new MissionSetupManager(
      this.campaignManager,
      this.themeManager,
      this.modalService,
    );

    this.missionCoordinator = new MissionCoordinator(
      this.campaignShell,
      this.gameClient,
      this.screenManager,
      this.menuController,
      this.campaignManager,
      (renderer) => config.onRendererCreated(renderer),
    );

    // 2. Initialize UI managers
    this.hudManager = new HUDManager(
      this.menuController,
      config.onUnitClick,
      config.onAbortMission,
      config.onMenuInput,
      config.onTimeScaleChange,
      config.onCopyWorldState,
      config.onDebugForceWin,
      config.onDebugForceLose,
      config.onStartMission,
      config.onDeployUnit,
    );

    this.inputManager = new InputManager(
      this.screenManager,
      this.menuController,
      this.modalService,
      config.onTogglePause,
      config.onMenuInput,
      config.onAbortMission,
      () => config.onUnitClick(null, false),
      config.getSelectedUnitId,
      config.onCanvasClick,
      config.onToggleDebug,
      config.onToggleLos,
      config.getCurrentGameState,
      config.isDebriefVisible,
      config.onDeployUnit,
      config.onUndeployUnit,
      config.getCellCoordinates,
      config.cycleUnits,
      config.panMap,
      config.panMapBy,
      config.zoomMap,
    );
    this.inputManager.init();
  }

  public finalizeNavigation(
    screens: NavigationScreens,
    squadBuilder: SquadBuilder,
    callbacks: {
      showMainMenu: () => void;
    }
  ) {
    this.missionRunner = new MissionRunner({
      missionCoordinator: this.missionCoordinator,
      missionSetupManager: this.missionSetupManager,
      gameClient: this.gameClient,
      campaignManager: this.campaignManager,
      hudManager: this.hudManager,
      menuController: this.menuController,
      modalService: this.modalService,
    });

    this.navigationOrchestrator = new NavigationOrchestrator(
      this.screenManager,
      this.campaignShell,
      this.campaignManager,
      this.themeManager,
      this.missionSetupManager,
      squadBuilder,
      screens,
      {
        showMainMenu: callbacks.showMainMenu,
        launchMission: () => this.missionRunner.launchMission(),
        resumeMission: () => this.missionRunner.resumeMission(),
      }
    );

    this.missionRunner.setNavigationOrchestrator(this.navigationOrchestrator);
  }
}
