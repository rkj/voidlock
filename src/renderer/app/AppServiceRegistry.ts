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
}
