import { AppContext } from "./AppContext";
import { Renderer } from "@src/renderer/Renderer";
import {
  GameState,
  UnitState,
  EngineMode,
  MapDefinition,
  SquadConfig,
  MissionType,
  MapGeneratorType,
  UnitStyle,
} from "@src/shared/types";
import {
  CampaignNode,
  MissionReport,
} from "@src/shared/campaign_types";
import { TimeUtility } from "@src/renderer/TimeUtility";

export class MissionCoordinator {
  private debriefShown = false;

  constructor(private context: AppContext) {}

  public launchMission(
    config: {
      seed: number;
      mapGeneratorType: MapGeneratorType;
      staticMapData?: MapDefinition;
      fogOfWarEnabled: boolean;
      debugOverlayEnabled: boolean;
      agentControlEnabled: boolean;
      squadConfig: SquadConfig;
      missionType: MissionType;
      mapWidth: number;
      mapHeight: number;
      spawnPointCount: number;
      losOverlayEnabled: boolean;
      startingThreatLevel: number;
      baseEnemyCount: number;
      enemyGrowthPerMission: number;
      allowTacticalPause: boolean;
      unitStyle: UnitStyle;
      campaignNode?: CampaignNode;
    },
    setupCallbacks: (report: MissionReport) => void,
    updateUI: (state: GameState) => void,
    syncSpeedUI: () => void,
  ) {
    const tsSlider = document.getElementById(
      "time-scale-slider",
    ) as HTMLInputElement;
    const initialTimeScale = tsSlider
      ? TimeUtility.sliderToScale(parseFloat(tsSlider.value))
      : 1.0;

    const missionDepth = config.campaignNode ? config.campaignNode.rank : 0;

    this.context.campaignShell.hide();

    this.context.gameClient.init(
      config.seed,
      config.mapGeneratorType,
      config.staticMapData,
      config.fogOfWarEnabled,
      config.debugOverlayEnabled,
      config.agentControlEnabled,
      config.squadConfig,
      config.missionType,
      config.mapWidth,
      config.mapHeight,
      config.spawnPointCount,
      config.losOverlayEnabled,
      config.startingThreatLevel,
      initialTimeScale,
      false, // startPaused
      config.allowTacticalPause,
      EngineMode.Simulation,
      [], // commandLog
      config.campaignNode?.id,
      0, // targetTick
      config.baseEnemyCount,
      config.enemyGrowthPerMission,
      missionDepth,
      config.campaignNode?.type,
      config.campaignNode?.bonusLootCount || 0,
    );

    syncSpeedUI();
    this.setupGameClientCallbacks(config, setupCallbacks, updateUI);
    this.context.screenManager.show("mission");
  }

  public setupGameClientCallbacks(
    config: { unitStyle: UnitStyle; campaignNode?: CampaignNode },
    onMissionEnd: (report: MissionReport) => void,
    updateUI: (state: GameState) => void,
  ) {
    this.debriefShown = false;
    const rightPanel = document.getElementById("right-panel");
    if (rightPanel) rightPanel.innerHTML = "";
    this.context.menuController.reset();
    this.context.menuController.clearDiscoveryOrder();

    this.context.gameClient.onStateUpdate((state) => {
      if (!this.context.renderer) {
        const canvas = document.getElementById(
          "game-canvas",
        ) as HTMLCanvasElement;
        if (canvas) {
          this.context.renderer = new Renderer(canvas);
          this.context.renderer.setCellSize(128);
        }
      }
      if (this.context.renderer) {
        this.context.renderer.setUnitStyle(config.unitStyle);
        this.context.renderer.setOverlay(
          this.context.menuController.overlayOptions,
        );
        this.context.renderer.render(state);
      }

      if (
        (state.status === "Won" || state.status === "Lost") &&
        !this.debriefShown
      ) {
        this.debriefShown = true;
        const report = this.generateMissionReport(state, config.campaignNode || null, state.seed);
        onMissionEnd(report);

        const replayData = this.context.gameClient.getReplayData();
        if (replayData) {
          this.context.gameClient.loadReplay(replayData);
          this.context.gameClient.setTimeScale(5.0);
        }
      }
      updateUI(state);
    });
  }

  public resumeMission(
    setupCallbacks: (report: MissionReport) => void,
    updateUI: (state: GameState) => void,
    syncSpeedUI: () => void,
    onCampaignNodeResolved: (node: CampaignNode | null) => void,
  ) {
    const configStr = localStorage.getItem("voidlock_mission_config");
    const logStr = localStorage.getItem("voidlock_mission_log");
    const tickStr = localStorage.getItem("voidlock_mission_tick");

    if (!configStr) return;

    try {
      const config = JSON.parse(configStr);
      const commandLog = logStr ? JSON.parse(logStr) : [];
      const targetTick = tickStr ? parseInt(tickStr, 10) : 0;

      let campaignNode: CampaignNode | null = null;
      if (config.campaignNodeId) {
        this.context.campaignManager.load();
        const campaignState = this.context.campaignManager.getState();
        if (campaignState) {
          campaignNode =
            campaignState.nodes.find((n) => n.id === config.campaignNodeId) ||
            null;
        }
      }
      onCampaignNodeResolved(campaignNode);

      const initialTimeScale = config.initialTimeScale || 1.0;
      const allowTacticalPause = config.allowTacticalPause ?? true;
      const baseEnemyCount = config.baseEnemyCount ?? 3;
      const enemyGrowthPerMission = config.enemyGrowthPerMission ?? 1;
      const missionDepth = config.missionDepth ?? 0;

      this.setupGameClientCallbacks(
        { unitStyle: config.unitStyle, campaignNode: campaignNode || undefined },
        setupCallbacks,
        updateUI,
      );

      this.context.gameClient.init(
        config.seed,
        config.mapGeneratorType,
        config.mapData,
        config.fogOfWarEnabled,
        config.debugOverlayEnabled,
        config.agentControlEnabled,
        config.squadConfig,
        config.missionType,
        config.width,
        config.height,
        config.spawnPointCount,
        config.losOverlayEnabled,
        config.startingThreatLevel,
        initialTimeScale,
        false,
        allowTacticalPause,
        EngineMode.Simulation,
        commandLog,
        config.campaignNodeId,
        targetTick,
        baseEnemyCount,
        enemyGrowthPerMission,
        missionDepth,
        config.nodeType,
        config.bonusLootCount || 0,
      );

      syncSpeedUI();
      this.context.screenManager.show("mission");
    } catch (e) {
      console.error("Failed to resume mission", e);
    }
  }

  public abortMission(
    currentGameState: GameState | null,
    currentCampaignNode: CampaignNode | null,
    currentSeed: number,
    currentSquad: SquadConfig,
    onAbortResolved: (report: MissionReport) => void,
    showMainMenu: () => void,
  ) {
    if (currentCampaignNode) {
      const report = this.generateAbortReport(currentGameState, currentCampaignNode, currentSeed, currentSquad);
      onAbortResolved(report);

      const state = this.context.campaignManager.getState();
      if (state && (state.status === "Victory" || state.status === "Defeat")) {
        this.context.gameClient.stop();
        this.context.gameClient.onStateUpdate(null);
        return true; // Indicates victory/defeat handled
      }
    }

    this.context.gameClient.stop();
    this.context.gameClient.onStateUpdate(null);

    const tsSlider = document.getElementById(
      "time-scale-slider",
    ) as HTMLInputElement;
    const tsValue = document.getElementById("time-scale-value");
    if (tsSlider) {
      tsSlider.value = "50";
      if (tsValue) tsValue.textContent = "1.0";
    }
    showMainMenu();
    return false;
  }

  public generateMissionReport(
    state: GameState,
    node: CampaignNode | null,
    seed: number,
  ): MissionReport {
    return {
      nodeId: node ? node.id : "custom",
      seed: seed,
      result: state.status === "Won" ? "Won" : "Lost",
      aliensKilled: state.stats.aliensKilled,
      scrapGained: state.stats.scrapGained,
      intelGained: state.status === "Won" ? 5 : 0,
      timeSpent: state.t,
      soldierResults: state.units.map((u) => ({
        soldierId: u.id,
        name: u.name,
        tacticalNumber: u.tacticalNumber,
        xpBefore: 0,
        xpGained: 0,
        kills: u.kills,
        promoted: false,
        status:
          u.state === UnitState.Dead
            ? "Dead"
            : u.hp < u.maxHp
              ? "Wounded"
              : "Healthy",
        recoveryTime: 0,
      })),
    };
  }

  private generateAbortReport(
    state: GameState | null,
    node: CampaignNode | null,
    seed: number,
    squadConfig: SquadConfig,
  ): MissionReport {
    if (state) {
      return {
        nodeId: node ? node.id : "custom",
        seed: seed,
        result: "Lost",
        aliensKilled: state.stats.aliensKilled,
        scrapGained: state.stats.scrapGained,
        intelGained: 0,
        timeSpent: state.t,
        soldierResults: state.units.map((u) => ({
          soldierId: u.id,
          name: u.name,
          tacticalNumber: u.tacticalNumber,
          xpBefore: 0,
          xpGained: 0,
          kills: u.kills,
          promoted: false,
          status: "Dead", // Abort = Squad Wipe
          recoveryTime: 0,
        })),
      };
    }

    // Fallback if no game state
    return {
      nodeId: node ? node.id : "custom",
      seed: seed,
      result: "Lost",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 0,
      soldierResults: squadConfig.soldiers.map((s) => ({
        soldierId: s.id!,
        name: s.name,
        tacticalNumber: s.tacticalNumber,
        xpBefore: 0,
        xpGained: 0,
        kills: 0,
        promoted: false,
        status: "Dead",
        recoveryTime: 0,
      })),
    };
  }
}
