import { Renderer } from "@src/renderer/Renderer";
import {
  GameState,
  UnitState,
  EngineMode,
  MapDefinition,
  SquadConfig,
  MissionType,
  MapGeneratorType,
} from "@src/shared/types";
import { CampaignNode, MissionReport } from "@src/shared/campaign_types";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { Logger } from "@src/shared/Logger";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";
import { GameClient } from "@src/engine/GameClient";
import { ScreenManager } from "@src/renderer/ScreenManager";
import { MenuController } from "@src/renderer/MenuController";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

import { ConfigManager } from "../ConfigManager";

export class MissionCoordinator {
  private debriefShown = false;
  private renderer: Renderer | null = null;

  constructor(
    private campaignShell: CampaignShell,
    private gameClient: GameClient,
    private screenManager: ScreenManager,
    private menuController: MenuController,
    private campaignManager: CampaignManager,
    private onRendererCreated: (renderer: Renderer) => void,
  ) {}

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
      campaignNode?: CampaignNode;
      skipDeployment: boolean;
      debugSnapshotInterval: number;
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
    const globalConfig = ConfigManager.loadGlobal();

    this.campaignShell.hide();

    this.gameClient.init(
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
      undefined, // startingPoints
      config.campaignNode?.bonusLootCount || 0,
      config.skipDeployment,
      globalConfig.debugSnapshots,
      config.debugSnapshotInterval,
    );

    syncSpeedUI();
    this.setupGameClientCallbacks(config, setupCallbacks, updateUI);
    this.screenManager.show("mission", true, !!config.campaignNode);
  }

  public setupGameClientCallbacks(
    config: { campaignNode?: CampaignNode },
    onMissionEnd: (report: MissionReport) => boolean | void,
    updateUI: (state: GameState) => void,
  ) {
    this.debriefShown = false;
    const rightPanel = document.getElementById("right-panel");
    if (rightPanel) rightPanel.innerHTML = "";
    this.menuController.reset();
    this.menuController.clearDiscoveryOrder();

    this.gameClient.onStateUpdate((state) => {
      if (!this.renderer) {
        const canvas = document.getElementById(
          "game-canvas",
        ) as HTMLCanvasElement;
        if (canvas) {
          this.renderer = new Renderer(canvas);
          this.renderer.setCellSize(128);
          this.onRendererCreated(this.renderer);
        }
      }
      if (this.renderer) {
        this.renderer.setUnitStyle(
          ConfigManager.loadGlobal().unitStyle,
        );
        this.renderer.setOverlay(
          this.menuController.overlayOptions,
        );
        this.renderer.render(state);
      }

      if (
        (state.status === "Won" || state.status === "Lost") &&
        !this.debriefShown
      ) {
        this.debriefShown = true;
        const report = this.generateMissionReport(
          state,
          config.campaignNode || null,
          state.seed,
        );
        onMissionEnd(report);
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
        this.campaignManager.load();
        const campaignState = this.campaignManager.getState();
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
        {
          campaignNode: campaignNode || undefined,
        },
        setupCallbacks,
        updateUI,
      );

      this.gameClient.init(
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
        undefined, // startingPoints
        config.bonusLootCount || 0,
        config.skipDeployment !== undefined ? config.skipDeployment : true,
        config.debugSnapshots,
        config.debugSnapshotInterval || 0,
      );

      syncSpeedUI();
      this.screenManager.show("mission", true, !!campaignNode);
    } catch (e) {
      Logger.error("Failed to resume mission", e);
    }
  }

  public abortMission(
    currentGameState: GameState | null,
    currentCampaignNode: CampaignNode | null,
    currentSeed: number,
    currentSquad: SquadConfig,
    onAbortResolved: (report: MissionReport) => void,
  ) {
    const report = this.generateAbortReport(
      currentGameState,
      currentCampaignNode,
      currentSeed,
      currentSquad,
    );
    onAbortResolved(report);

    if (currentCampaignNode) {
      const state = this.campaignManager.getState();
      if (state && (state.status === "Victory" || state.status === "Defeat")) {
        this.gameClient.stop();
        this.gameClient.onStateUpdate(null);
        return true; // Indicates victory/defeat handled
      }

      this.gameClient.stop();
      this.gameClient.onStateUpdate(null);
      return true; // Campaign mission abort handled by onAbortResolved
    }

    this.gameClient.stop();
    this.gameClient.onStateUpdate(null);

    const tsSlider = document.getElementById(
      "time-scale-slider",
    ) as HTMLInputElement;
    const tsValue = document.getElementById("time-scale-value");
    if (tsSlider) {
      tsSlider.value = "50";
      if (tsValue) tsValue.textContent = "1.0";
    }
    // For custom missions, we now also call onAbortResolved which should show debrief
    // so we don't call showMainMenu() here anymore.
    return true;
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
