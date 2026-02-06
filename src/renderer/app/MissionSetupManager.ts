import { AppContext } from "./AppContext";
import {
  MapGeneratorType,
  MissionType,
  SquadConfig,
  MapDefinition,
} from "@src/shared/types";
import { CampaignNode } from "@src/shared/campaign_types";
import { ConfigManager, GameConfig } from "../ConfigManager";
import { MapUtility } from "@src/renderer/MapUtility";
import { MapValidator } from "@src/shared/validation/MapValidator";
import { MapFactory } from "@src/engine/map/MapFactory";
import { SquadBuilder } from "../components/SquadBuilder";
import { NameGenerator } from "@src/shared/utils/NameGenerator";
import { ArchetypeLibrary } from "@src/shared/types/units";

export class MissionSetupManager {
  public fogOfWarEnabled = ConfigManager.getDefault().fogOfWarEnabled;
  public debugOverlayEnabled = ConfigManager.getDefault().debugOverlayEnabled;
  public losOverlayEnabled = false;
  public agentControlEnabled = ConfigManager.getDefault().agentControlEnabled;
  public manualDeployment = ConfigManager.getDefault().manualDeployment;
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

  private squadBuilder: SquadBuilder;

  constructor(private context: AppContext) {
    this.squadBuilder = new SquadBuilder(
      "squad-builder",
      this.context,
      this.currentSquad,
      this.currentMissionType,
      false,
      (squad) => {
        this.currentSquad = squad;
      },
    );
  }

  public rehydrateCampaignNode(): boolean {
    const config = ConfigManager.loadCampaign();
    if (config && config.campaignNodeId) {
      const state = this.context.campaignManager.getState();
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

  public getSquadBuilder(): SquadBuilder {
    return this.squadBuilder;
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

    this.context.campaignShell.show("campaign", "sector-map", false);
    this.context.screenManager.show("mission-setup", true, true);
  }

  public saveCurrentConfig() {
    const mapSeedInput = document.getElementById(
      "map-seed",
    ) as HTMLInputElement;
    if (mapSeedInput && !mapSeedInput.disabled) {
      const val = parseInt(mapSeedInput.value);
      this.currentSeed = !isNaN(val) ? val : this.currentSeed;
    }

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    const spInput = document.getElementById(
      "map-spawn-points",
    ) as HTMLInputElement;
    const baseEnemiesInput = document.getElementById(
      "map-base-enemies",
    ) as HTMLInputElement;
    const growthInput = document.getElementById(
      "map-enemy-growth",
    ) as HTMLInputElement;
    const threatInput = document.getElementById(
      "map-starting-threat",
    ) as HTMLInputElement;

    if (wInput && hInput) {
      this.currentMapWidth = parseInt(wInput.value) || 10;
      this.currentMapHeight = parseInt(hInput.value) || 10;
    }
    if (spInput) this.currentSpawnPointCount = parseInt(spInput.value) || 1;

    let baseEnemyCount = 3;
    if (baseEnemiesInput)
      baseEnemyCount = parseInt(baseEnemiesInput.value) || 3;
    let enemyGrowthPerMission = 1;
    if (growthInput) enemyGrowthPerMission = parseFloat(growthInput.value) || 1;
    let startingThreatLevel = 0;
    if (threatInput) startingThreatLevel = parseInt(threatInput.value) || 0;

    if (this.currentCampaignNode) {
      const campaignState = this.context.campaignManager.getState();
      if (campaignState) {
        this.allowTacticalPause = campaignState.rules.allowTacticalPause;
        this.currentMapGeneratorType = campaignState.rules.mapGeneratorType;
        baseEnemyCount = campaignState.rules.baseEnemyCount;
        enemyGrowthPerMission = campaignState.rules.enemyGrowthPerMission;
      }
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
    const contextHeader = document.getElementById("mission-setup-context");
    if (contextHeader) {
      if (isCampaign) {
        const state = this.context.campaignManager.getState();
        if (state) {
          const missionNum = state.history.length + 1;
          const sectorNum = state.currentSector;
          const difficulty = state.rules.difficulty.toUpperCase();
          contextHeader.textContent = `CAMPAIGN: ${difficulty} | MISSION ${missionNum} | SECTOR ${sectorNum}`;
        }
      } else {
        contextHeader.textContent = "CUSTOM SIMULATION";
      }
    }

    const config = isCampaign
      ? ConfigManager.loadCampaign()
      : ConfigManager.loadCustom();
    const mapConfigSection = document.getElementById("map-config-section");
    if (mapConfigSection)
      mapConfigSection.style.display = isCampaign ? "none" : "block";

    const global = ConfigManager.loadGlobal();
    this.unitStyle = global.unitStyle;
    this.currentThemeId = global.themeId;

    if (config) {
      this.currentMapWidth = config.mapWidth;
      this.currentMapHeight = config.mapHeight;
      this.currentSpawnPointCount = config.spawnPointCount || 1;
      this.fogOfWarEnabled = config.fogOfWarEnabled;
      this.debugOverlayEnabled = config.debugOverlayEnabled;
      this.losOverlayEnabled = config.losOverlayEnabled || false;
      this.agentControlEnabled = config.agentControlEnabled;
      this.manualDeployment = config.manualDeployment || false;
      this.allowTacticalPause =
        config.allowTacticalPause !== undefined
          ? config.allowTacticalPause
          : true;
      this.currentMapGeneratorType = config.mapGeneratorType;
      this.currentMissionType = config.missionType || MissionType.Default;
      this.currentSeed = config.lastSeed;
      this.currentSquad = config.squadConfig;

      this.updateSetupUIFromConfig(config);
    } else {
      const defaults = ConfigManager.getDefault();
      this.currentMapWidth = defaults.mapWidth;
      this.currentMapHeight = defaults.mapHeight;
      this.currentSpawnPointCount = defaults.spawnPointCount;
      this.fogOfWarEnabled = defaults.fogOfWarEnabled;
      this.debugOverlayEnabled = defaults.debugOverlayEnabled;
      this.losOverlayEnabled = defaults.losOverlayEnabled;
      this.agentControlEnabled = defaults.agentControlEnabled;
      this.manualDeployment = defaults.manualDeployment;
      this.allowTacticalPause = defaults.allowTacticalPause;
      this.currentMapGeneratorType = defaults.mapGeneratorType;
      this.currentMissionType = defaults.missionType;
      this.currentSeed = defaults.lastSeed;
      this.currentSquad = JSON.parse(JSON.stringify(defaults.squadConfig));

      this.updateSetupUIFromConfig(defaults);
    }

    this.context.themeManager.setTheme(this.currentThemeId);
    this.renderGlobalStatus();

    if (isCampaign) {
      const state = this.context.campaignManager.getState();
      if (state) {
        if (state.rules.mapGeneratorType) {
          this.currentMapGeneratorType = state.rules.mapGeneratorType;
          const mapGenSelect = document.getElementById(
            "map-generator-type",
          ) as HTMLSelectElement;
          if (mapGenSelect) mapGenSelect.value = this.currentMapGeneratorType;
        }
        if (state.rules.allowTacticalPause !== undefined) {
          this.allowTacticalPause = state.rules.allowTacticalPause;
          const allowPauseCheck = document.getElementById(
            "toggle-allow-tactical-pause",
          ) as HTMLInputElement;
          if (allowPauseCheck)
            allowPauseCheck.checked = this.allowTacticalPause;
        }

        const hasNonCampaignSoldiers = this.currentSquad.soldiers.some(
          (s) => !s.id,
        );
        if (this.currentSquad.soldiers.length === 0 || hasNonCampaignSoldiers) {
          const healthy = state.roster
            .filter((s) => s.status === "Healthy")
            .slice(0, 4);
          this.currentSquad.soldiers = healthy.map((s) => ({
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
          }));
        } else {
          this.currentSquad.soldiers = this.currentSquad.soldiers.filter(
            (s) => {
              if (s.id) {
                const rs = state.roster.find((r) => r.id === s.id);
                if (rs) {
                  if (rs.status === "Dead" || rs.status === "Wounded")
                    return false;
                  s.name = rs.name;
                  s.hp = rs.hp;
                  s.maxHp = rs.maxHp;
                  s.soldierAim = rs.soldierAim;
                  s.rightHand = rs.equipment.rightHand;
                  s.leftHand = rs.equipment.leftHand;
                  s.body = rs.equipment.body;
                  s.feet = rs.equipment.feet;
                  return true;
                }
              }
              return true;
            },
          );
        }
      }
    } else {
      // Hydrate custom soldiers if they lack names/stats
      this.currentSquad.soldiers.forEach((s) => {
        if (!s.name) {
          const arch = ArchetypeLibrary[s.archetypeId];
          if (arch) {
            s.name = NameGenerator.generate();
            s.hp = arch.baseHp;
            s.maxHp = arch.baseHp;
            s.soldierAim = arch.soldierAim;
            s.rightHand = s.rightHand || arch.rightHand;
            s.leftHand = s.leftHand || arch.leftHand;
            s.body = s.body || arch.body;
            s.feet = s.feet || arch.feet;
          }
        }
      });
    }
    this.renderSquadBuilder(isCampaign);
  }

  public updateSetupUIFromConfig(config: GameConfig | Partial<GameConfig>) {
    const missionSelect = document.getElementById(
      "mission-type",
    ) as HTMLSelectElement;
    if (missionSelect) missionSelect.value = this.currentMissionType;
    const mapSeedInput = document.getElementById(
      "map-seed",
    ) as HTMLInputElement;
    if (mapSeedInput) mapSeedInput.value = this.currentSeed.toString();
    const mapGenSelect = document.getElementById(
      "map-generator-type",
    ) as HTMLSelectElement;
    if (mapGenSelect) mapGenSelect.value = this.currentMapGeneratorType;

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    const spInput = document.getElementById(
      "map-spawn-points",
    ) as HTMLInputElement;
    const threatInput = document.getElementById(
      "map-starting-threat",
    ) as HTMLInputElement;

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

    const baseEnemiesInput = document.getElementById(
      "map-base-enemies",
    ) as HTMLInputElement;
    if (baseEnemiesInput) {
      baseEnemiesInput.value = (config.baseEnemyCount ?? 3).toString();
      const valDisp = document.getElementById("map-base-enemies-value");
      if (valDisp) valDisp.textContent = baseEnemiesInput.value;
    }
    const growthInput = document.getElementById(
      "map-enemy-growth",
    ) as HTMLInputElement;
    if (growthInput) {
      growthInput.value = (config.enemyGrowthPerMission ?? 1).toString();
      const valDisp = document.getElementById("map-enemy-growth-value");
      if (valDisp) valDisp.textContent = growthInput.value;
    }

    const fowCheck = document.getElementById(
      "toggle-fog-of-war",
    ) as HTMLInputElement;
    if (fowCheck) fowCheck.checked = this.fogOfWarEnabled;
    const debugCheck = document.getElementById(
      "toggle-debug-overlay",
    ) as HTMLInputElement;
    if (debugCheck) debugCheck.checked = this.debugOverlayEnabled;
    const losCheck = document.getElementById(
      "toggle-los-overlay",
    ) as HTMLInputElement;
    if (losCheck) losCheck.checked = this.losOverlayEnabled;
    const agentCheck = document.getElementById(
      "toggle-agent-control",
    ) as HTMLInputElement;
    if (agentCheck) agentCheck.checked = this.agentControlEnabled;
    const deploymentCheck = document.getElementById(
      "toggle-manual-deployment",
    ) as HTMLInputElement;
    if (deploymentCheck) deploymentCheck.checked = this.manualDeployment;
    const allowPauseCheck = document.getElementById(
      "toggle-allow-tactical-pause",
    ) as HTMLInputElement;
    if (allowPauseCheck) allowPauseCheck.checked = this.allowTacticalPause;

    this.renderGlobalStatus();

    if (mapGenSelect) mapGenSelect.dispatchEvent(new Event("change"));
  }

  private renderGlobalStatus() {
    const el = document.getElementById("setup-global-status");
    if (!el) return;

    const themeLabel =
      this.currentThemeId.charAt(0).toUpperCase() +
      this.currentThemeId.slice(1);
    el.textContent = `${this.unitStyle} | ${themeLabel}`;
  }

  public renderSquadBuilder(isCampaign: boolean = false) {
    this.squadBuilder.update(
      this.currentSquad,
      this.currentMissionType,
      isCampaign,
    );
  }

  public async loadStaticMap(json: string) {
    try {
      const parsed = JSON.parse(json);
      const validation = MapValidator.validate(parsed);
      if (!validation.success) {
        await this.context.modalService.alert(
          `Invalid map format: ${validation.error}`,
        );
        return;
      }
      this.currentStaticMapData = MapUtility.transformMapData(
        validation.data as MapDefinition,
      );
      await this.context.modalService.alert("Static Map Loaded.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      await this.context.modalService.alert(`Error loading map: ${message}`);
    }
  }

  public async uploadStaticMap(file: File) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const validation = MapValidator.validate(parsed);
        if (!validation.success) {
          await this.context.modalService.alert(
            `Invalid map format: ${validation.error}`,
          );
          return;
        }
        this.currentStaticMapData = MapUtility.transformMapData(
          validation.data as MapDefinition,
        );
        await this.context.modalService.alert("Static Map Loaded from File.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await this.context.modalService.alert(`Invalid file: ${message}`);
      }
    };
    reader.readAsText(file);
  }

  public async convertAscii(ascii: string) {
    try {
      if (ascii) {
        this.currentStaticMapData = MapFactory.fromAscii(ascii);
      }
      await this.context.modalService.alert("ASCII Map Converted.");
    } catch (e) {
      await this.context.modalService.alert("Invalid ASCII.");
    }
  }
}
