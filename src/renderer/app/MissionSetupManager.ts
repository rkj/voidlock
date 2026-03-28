import type {
  MapGeneratorType,
  SquadConfig,
  MapDefinition} from "@src/shared/types";
import {
  MissionType
} from "@src/shared/types";
import type {
  CampaignNode,
  CampaignState} from "@src/shared/campaign_types";
import {
  calculateMapSize,
  calculateSpawnPoints,
} from "@src/shared/campaign_types";
import type { GameConfig } from "../ConfigManager";
import { ConfigManager } from "../ConfigManager";
import { MapUtility } from "@src/renderer/MapUtility";
import { MapValidator } from "@src/shared/validation/MapValidator";
import { MapFactory } from "@src/engine/map/MapFactory";
import { NameGenerator } from "@src/shared/utils/NameGenerator";
import { ArchetypeLibrary } from "@src/shared/types/units";
import type { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import type { ThemeManager } from "@src/renderer/ThemeManager";
import type { ModalService } from "@src/renderer/ui/ModalService";
import { Logger } from "@src/shared/Logger";

export class MissionSetupManager {
  public fogOfWarEnabled = ConfigManager.getDefault().fogOfWarEnabled;
  public debugOverlayEnabled = ConfigManager.getDefault().debugOverlayEnabled;
  public losOverlayEnabled = false;
  public agentControlEnabled = ConfigManager.getDefault().agentControlEnabled;
  public manualDeployment = ConfigManager.getDefault().manualDeployment;
  public debugSnapshotInterval =
    ConfigManager.getDefault().debugSnapshotInterval;
  public allowTacticalPause = true;
  public unitStyle = ConfigManager.loadGlobal().unitStyle;

  public currentMapWidth = ConfigManager.getDefault().mapWidth;
  public currentMapHeight = ConfigManager.getDefault().mapHeight;
  public currentSeed: number = ConfigManager.getDefault().lastSeed;
  public currentThemeId: string = ConfigManager.loadGlobal().themeId;
  public currentMapGeneratorType: MapGeneratorType =
    ConfigManager.getDefault().mapGeneratorType;
  public currentMissionType: MissionType =
    ConfigManager.getDefault().missionType;
  public currentStaticMapData: MapDefinition | undefined = undefined;
  public currentSquad: SquadConfig = ConfigManager.getDefault().squadConfig;
  public currentSpawnPointCount = ConfigManager.getDefault().spawnPointCount;
  public currentCampaignNode: CampaignNode | null = null;

  public isCampaign(): boolean {
    return this.currentCampaignNode !== null;
  }

  constructor(
    private campaignManager: CampaignManager,
    private themeManager: ThemeManager,
    private modalService: ModalService,
  ) {}

  public rehydrateCampaignNode(): boolean {
    const config = ConfigManager.loadCampaign();
    if (config?.campaignNodeId) {
      const state = this.campaignManager.getState();
      if (state) {
        const node = state.nodes.find((n) => n.id === config.campaignNodeId);
        if (node) {
          this.currentCampaignNode = node;
          return true;
        }
      }
    }
    return false;
  }

  public prepareMissionSetup(
    node: CampaignNode,
    size: number,
    spawnPoints: number,
  ) {
    this.currentCampaignNode = node;
    this.currentSeed = node.mapSeed;

    this.loadAndApplyConfig(true);

    this.currentSeed = node.mapSeed;
    this.currentMapWidth = size;
    this.currentMapHeight = size;
    this.currentSpawnPointCount = spawnPoints;

    const mapSeedInput = document.getElementById(
      "map-seed",
    ) as HTMLInputElement;
    if (mapSeedInput) mapSeedInput.value = this.currentSeed.toString();

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    if (wInput) wInput.value = this.currentMapWidth.toString();
    if (hInput) hInput.value = this.currentMapHeight.toString();

    const spInput = document.getElementById(
      "map-spawn-points",
    ) as HTMLInputElement;
    if (spInput) {
      spInput.value = this.currentSpawnPointCount.toString();
      const spVal = document.getElementById("map-spawn-points-value");
      if (spVal) spVal.textContent = spInput.value;
    }

    this.saveCurrentConfig();
  }

  private readMapDimensions() {
    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    if (wInput && hInput) {
      this.currentMapWidth = parseInt(wInput.value) || 10;
      this.currentMapHeight = parseInt(hInput.value) || 10;
    }
    const spInput = document.getElementById("map-spawn-points") as HTMLInputElement;
    if (spInput) this.currentSpawnPointCount = parseInt(spInput.value) || 1;
  }

  private readEnemyParams(): { baseEnemyCount: number; enemyGrowthPerMission: number; startingThreatLevel: number } {
    const baseEnemiesInput = document.getElementById("map-base-enemies") as HTMLInputElement;
    const growthInput = document.getElementById("map-enemy-growth") as HTMLInputElement;
    const threatInput = document.getElementById("map-starting-threat") as HTMLInputElement;
    const baseEnemyCount = baseEnemiesInput ? parseInt(baseEnemiesInput.value) || 3 : 3;
    const enemyGrowthPerMission = growthInput ? parseFloat(growthInput.value) || 1 : 1;
    const startingThreatLevel = threatInput ? parseInt(threatInput.value) || 0 : 0;
    return { baseEnemyCount, enemyGrowthPerMission, startingThreatLevel };
  }

  private applyCampaignRules(params: { baseEnemyCount: number; enemyGrowthPerMission: number }) {
    const campaignState = this.campaignManager.getState();
    if (!campaignState) return params;
    this.allowTacticalPause = campaignState.rules.allowTacticalPause;
    this.currentMapGeneratorType = campaignState.rules.mapGeneratorType;
    return {
      baseEnemyCount: campaignState.rules.baseEnemyCount,
      enemyGrowthPerMission: campaignState.rules.enemyGrowthPerMission,
    };
  }

  public saveCurrentConfig() {
    Logger.debug("[MissionSetupManager] saveCurrentConfig, hasNode:", !!this.currentCampaignNode);
    const mapSeedInput = document.getElementById(
      "map-seed",
    ) as HTMLInputElement;
    if (mapSeedInput && !mapSeedInput.disabled) {
      const val = parseInt(mapSeedInput.value);
      this.currentSeed = !isNaN(val) ? val : this.currentSeed;
    }

    this.readMapDimensions();
    let { baseEnemyCount, enemyGrowthPerMission } = this.readEnemyParams();
    const { startingThreatLevel } = this.readEnemyParams();

    if (this.currentCampaignNode) {
      const updated = this.applyCampaignRules({ baseEnemyCount, enemyGrowthPerMission });
      baseEnemyCount = updated.baseEnemyCount;
      enemyGrowthPerMission = updated.enemyGrowthPerMission;
    }

    const config: GameConfig = {
      mapWidth: this.currentMapWidth,
      mapHeight: this.currentMapHeight,
      spawnPointCount: this.currentSpawnPointCount,
      fogOfWarEnabled: this.fogOfWarEnabled,
      debugOverlayEnabled: this.debugOverlayEnabled,
      losOverlayEnabled: this.losOverlayEnabled,
      agentControlEnabled: this.agentControlEnabled,
      manualDeployment: this.manualDeployment,
      allowTacticalPause: this.allowTacticalPause,
      mapGeneratorType: this.currentMapGeneratorType,
      missionType: this.currentMissionType,
      lastSeed: this.currentSeed,
      squadConfig: this.currentSquad,
      startingThreatLevel,
      baseEnemyCount,
      enemyGrowthPerMission,
      debugSnapshotInterval: this.debugSnapshotInterval,
      campaignNodeId: this.currentCampaignNode?.id,
      bonusLootCount: this.currentCampaignNode?.bonusLootCount || 0,
    };

    const global = {
      ...ConfigManager.loadGlobal(),
      unitStyle: this.unitStyle,
      themeId: this.currentThemeId,
    };

    if (this.currentCampaignNode) {
      ConfigManager.saveCampaign(config, global);
    } else {
      ConfigManager.saveCustom(config, global);
    }

    return { ...config, ...global };
  }

  public loadAndApplyConfig(isCampaign: boolean = false) {
    this.updateContextHeader(isCampaign);
    this.updateSetupUIVisibility(isCampaign);

    const global = ConfigManager.loadGlobal();
    this.unitStyle = global.unitStyle;
    this.currentThemeId = global.themeId;

    const config = isCampaign ? ConfigManager.loadCampaign() : ConfigManager.loadCustom();
    if (config) {
      this.applyConfigValues(config, global, isCampaign);
      this.updateSetupUIFromConfig(config);
    } else {
      this.applyDefaultValues(global, isCampaign);
    }

    this.themeManager.setTheme(this.currentThemeId);

    if (isCampaign) {
      this.applyCampaignStateOverrides();
    } else {
      this.hydrateCustomSoldiers();
    }
  }

  private updateContextHeader(isCampaign: boolean) {
    const contextHeader = document.getElementById("mission-setup-context");
    if (!contextHeader) return;
    if (isCampaign) {
      const state = this.campaignManager.getState();
      if (state) {
        const missionNum = state.history.length + 1;
        const sectorNum = state.currentSector;
        const difficulty = state.rules.difficulty;
        const difficultyCased = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        contextHeader.textContent = `Campaign: ${difficultyCased} | Mission ${missionNum} | Sector ${sectorNum}`;
      }
    } else {
      contextHeader.textContent = "Custom Simulation";
    }
  }

  private updateSetupUIVisibility(isCampaign: boolean) {
    const mapConfigSection = document.getElementById("map-config-section");
    if (mapConfigSection) mapConfigSection.style.display = isCampaign ? "none" : "block";
    const setupTitle = document.getElementById("mission-setup-title");
    if (setupTitle) setupTitle.textContent = isCampaign ? "Mission Briefing" : "Mission Configuration";
    const equipmentBtn = document.getElementById("btn-goto-equipment");
    if (equipmentBtn) equipmentBtn.style.display = isCampaign ? "none" : "block";
  }

  private applyConfigValues(config: GameConfig, global: { debugSnapshotInterval: number }, isCampaign: boolean) {
    this.currentMapWidth = config.mapWidth;
    this.currentMapHeight = config.mapHeight;
    this.currentSpawnPointCount = config.spawnPointCount || 1;
    this.fogOfWarEnabled = config.fogOfWarEnabled;
    this.debugOverlayEnabled = config.debugOverlayEnabled;
    this.losOverlayEnabled = config.losOverlayEnabled || false;
    this.agentControlEnabled = config.agentControlEnabled;
    this.manualDeployment = config.manualDeployment || false;
    this.debugSnapshotInterval = config.debugSnapshotInterval ?? global.debugSnapshotInterval;
    this.allowTacticalPause = config.allowTacticalPause ?? true;
    this.currentMapGeneratorType = config.mapGeneratorType;
    this.currentMissionType = config.missionType || MissionType.Default;
    this.currentSeed = (isCampaign && this.currentCampaignNode)
      ? this.currentCampaignNode.mapSeed
      : config.lastSeed;
    
    if (config.squadConfig) {
      this.currentSquad = config.squadConfig;
    }
  }

  private applyDefaultValues(global: { debugSnapshotInterval: number }, isCampaign: boolean) {
    const defaults = ConfigManager.getDefault();
    this.currentMapWidth = defaults.mapWidth;
    this.currentMapHeight = defaults.mapHeight;
    this.currentSpawnPointCount = defaults.spawnPointCount;
    this.fogOfWarEnabled = defaults.fogOfWarEnabled;
    this.debugOverlayEnabled = defaults.debugOverlayEnabled;
    this.losOverlayEnabled = defaults.losOverlayEnabled;
    this.agentControlEnabled = defaults.agentControlEnabled;
    this.manualDeployment = defaults.manualDeployment;
    this.debugSnapshotInterval = global.debugSnapshotInterval;
    this.allowTacticalPause = defaults.allowTacticalPause;
    this.currentMapGeneratorType = defaults.mapGeneratorType;
    this.currentMissionType = defaults.missionType;
    this.currentSeed = (isCampaign && this.currentCampaignNode)
      ? this.currentCampaignNode.mapSeed
      : defaults.lastSeed;
    this.currentSquad = structuredClone(defaults.squadConfig);
    this.updateSetupUIFromConfig(defaults);
  }

  private applyCampaignStateOverrides() {
    const state = this.campaignManager.getState();
    if (!state) return;

    if (state.rules.mapGeneratorType) {
      this.currentMapGeneratorType = state.rules.mapGeneratorType;
      const mapGenSelect = document.getElementById("map-generator-type") as HTMLSelectElement;
      if (mapGenSelect) mapGenSelect.value = this.currentMapGeneratorType;
    }
    if (state.rules.allowTacticalPause !== undefined) {
      this.allowTacticalPause = state.rules.allowTacticalPause;
      const allowPauseCheck = document.getElementById("toggle-allow-tactical-pause") as HTMLInputElement;
      if (allowPauseCheck) allowPauseCheck.checked = this.allowTacticalPause;
    }

    if (this.currentCampaignNode) {
      this.applyCampaignNodeOverrides(state);
    }

    this.syncCampaignSquad(state);
  }

  private applyCampaignNodeOverrides(state: CampaignState) {
    if (!this.currentCampaignNode) return;
    const growthRate = state.rules?.mapGrowthRate ?? 1.0;
    this.currentMapWidth = calculateMapSize(this.currentCampaignNode.rank, growthRate);
    this.currentMapHeight = this.currentMapWidth;
    this.currentSpawnPointCount = calculateSpawnPoints(this.currentMapWidth);
    this.currentSeed = this.currentCampaignNode.mapSeed;
    this.currentMissionType = this.currentCampaignNode.missionType || MissionType.Default;

    const seedInput = document.getElementById("map-seed") as HTMLInputElement;
    if (seedInput) seedInput.value = this.currentSeed.toString();
    const wInput = document.getElementById("map-width") as HTMLInputElement;
    if (wInput) wInput.value = this.currentMapWidth.toString();
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    if (hInput) hInput.value = this.currentMapHeight.toString();
    const spInput = document.getElementById("map-spawn-points") as HTMLInputElement;
    if (spInput) {
      spInput.value = this.currentSpawnPointCount.toString();
      const spVal = document.getElementById("map-spawn-points-value");
      if (spVal) spVal.textContent = spInput.value;
    }
    const missionSelect = document.getElementById("mission-type") as HTMLSelectElement;
    if (missionSelect) missionSelect.value = this.currentMissionType;
  }

  private syncCampaignSquad(state: CampaignState) {
    const isPrologue = this.currentMissionType === MissionType.Prologue;
    const hasNonCampaignSoldiers = this.currentSquad.soldiers.some((s) => s && !s.id);
    if (this.currentSquad.soldiers.length === 0 || hasNonCampaignSoldiers || isPrologue) {
      const active = state.roster
        .filter((s) => s.status === "Healthy" || s.status === "Wounded")
        .slice(0, isPrologue ? 1 : 4);
      this.currentSquad.soldiers = active.map((s) => ({
        id: s.id,
        name: s.name,
        archetypeId: s.archetypeId,
        hp: s.hp,
        maxHp: s.maxHp,
        soldierAim: s.soldierAim,
        rightHand: s.equipment.rightHand,
        leftHand: s.equipment.leftHand,
        body: s.equipment.body,
        feet: s.equipment.feet,
        status: s.status,
      }));
    } else {
      this.currentSquad.soldiers = this.currentSquad.soldiers.filter((s) => {
        if (!s?.id) return true;
        const rs = state.roster.find((r) => r.id === s.id);
        if (!rs) return false;
        s.name = rs.name;
        s.status = rs.status;
        s.hp = rs.hp;
        s.maxHp = rs.maxHp;
        s.soldierAim = rs.soldierAim;
        s.rightHand = rs.equipment.rightHand;
        s.leftHand = rs.equipment.leftHand;
        s.body = rs.equipment.body;
        s.feet = rs.equipment.feet;
        return true;
      });
    }
  }

  private hydrateCustomSoldiers() {
    this.currentSquad.soldiers.forEach((s) => {
      // Ensure custom soldiers do not have campaign IDs to prevent state leakage (ADR 0039)
      delete s.id;
      if (s.name) return;
      const arch = ArchetypeLibrary[s.archetypeId];
      if (!arch) return;
      s.name = NameGenerator.generate();
      s.hp = arch.baseHp;
      s.maxHp = arch.baseHp;
      s.soldierAim = arch.soldierAim;
      s.rightHand = s.rightHand || arch.rightHand;
      s.leftHand = s.leftHand || arch.leftHand;
      s.body = s.body || arch.body;
      s.feet = s.feet || arch.feet;
    });
  }

  public updateSetupUIFromConfig(config: GameConfig | Partial<GameConfig>) {
    this.updateMapSelectors();
    this.updateMapSizeInputs(config);
    this.updateEnemyInputs(config);
    this.updateToggleInputs();

    const mapGenSelect = document.getElementById("map-generator-type") as HTMLSelectElement;
    if (mapGenSelect) mapGenSelect.dispatchEvent(new Event("change"));
  }

  private updateMapSelectors() {
    const missionSelect = document.getElementById("mission-type") as HTMLSelectElement;
    if (missionSelect) missionSelect.value = this.currentMissionType;
    const mapSeedInput = document.getElementById("map-seed") as HTMLInputElement;
    if (mapSeedInput) mapSeedInput.value = this.currentSeed.toString();
    const mapGenSelect = document.getElementById("map-generator-type") as HTMLSelectElement;
    if (mapGenSelect) mapGenSelect.value = this.currentMapGeneratorType;
  }

  private updateMapSizeInputs(config: GameConfig | Partial<GameConfig>) {
    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    const spInput = document.getElementById("map-spawn-points") as HTMLInputElement;
    const threatInput = document.getElementById("map-starting-threat") as HTMLInputElement;

    if (wInput) wInput.value = this.currentMapWidth.toString();
    if (hInput) hInput.value = this.currentMapHeight.toString();
    if (spInput) {
      spInput.value = this.currentSpawnPointCount.toString();
      const spVal = document.getElementById("map-spawn-points-value");
      if (spVal) spVal.textContent = spInput.value;
    }
    if (threatInput) {
      threatInput.value = (config.startingThreatLevel || 0).toString();
      const threatVal = document.getElementById("map-starting-threat-value");
      if (threatVal) threatVal.textContent = threatInput.value;
    }
  }

  private updateEnemyInputs(config: GameConfig | Partial<GameConfig>) {
    const baseEnemiesInput = document.getElementById("map-base-enemies") as HTMLInputElement;
    if (baseEnemiesInput) {
      baseEnemiesInput.value = (config.baseEnemyCount ?? 3).toString();
      const valDisp = document.getElementById("map-base-enemies-value");
      if (valDisp) valDisp.textContent = baseEnemiesInput.value;
    }
    const growthInput = document.getElementById("map-enemy-growth") as HTMLInputElement;
    if (growthInput) {
      growthInput.value = (config.enemyGrowthPerMission ?? 1).toString();
      const valDisp = document.getElementById("map-enemy-growth-value");
      if (valDisp) valDisp.textContent = growthInput.value;
    }
  }

  private updateToggleInputs() {
    const setCheckbox = (id: string, value: boolean) => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el) el.checked = value;
    };
    setCheckbox("toggle-fog-of-war", this.fogOfWarEnabled);
    setCheckbox("toggle-debug-overlay", this.debugOverlayEnabled);
    setCheckbox("toggle-los-overlay", this.losOverlayEnabled);
    setCheckbox("toggle-agent-control", this.agentControlEnabled);
    setCheckbox("toggle-manual-deployment", this.manualDeployment);
    setCheckbox("toggle-allow-tactical-pause", this.allowTacticalPause);
  }

  public async loadStaticMap(json: string) {
    try {
      const parsed = JSON.parse(json);
      const validation = MapValidator.validate(parsed);
      if (!validation.success) {
        await this.modalService.alert(
          `Invalid map format: ${validation.error}`,
        );
        return;
      }
      this.currentStaticMapData = MapUtility.transformMapData(
        validation.data as MapDefinition,
      );
      await this.modalService.alert("Static Map Loaded.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      await this.modalService.alert(`Error loading map: ${message}`);
    }
  }

  public uploadStaticMap(file: File) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const validation = MapValidator.validate(parsed);
        if (!validation.success) {
          await this.modalService.alert(
            `Invalid map format: ${validation.error}`,
          );
          return;
        }
        this.currentStaticMapData = MapUtility.transformMapData(
          validation.data as MapDefinition,
        );
        await this.modalService.alert("Static Map Loaded from File.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await this.modalService.alert(`Invalid file: ${message}`);
      }
    };
    reader.readAsText(file);
  }

  public async convertAscii(ascii: string) {
    try {
      if (ascii) {
        this.currentStaticMapData = MapFactory.fromAscii(ascii);
      }
      await this.modalService.alert("ASCII Map Converted.");
    } catch (_e) {
      await this.modalService.alert("Invalid ASCII.");
    }
  }
}
