// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InputBinder } from "@src/renderer/app/InputBinder";
import { AppContext } from "@src/renderer/app/AppContext";
import { UnitStyle, MapGeneratorType, MissionType } from "@src/shared/types";

describe("InputBinder", () => {
  let inputBinder: InputBinder;
  let mockContext: any;
  let mockCallbacks: any;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-mission-setup">
        <select id="map-generator-type">
          <option value="Procedural">Procedural</option>
          <option value="TreeShip">Tree Ship</option>
          <option value="DenseShip">Dense Ship</option>
          <option value="Static">Static Map</option>
        </select>
        <select id="mission-type">
          <option value="Default">Default</option>
          <option value="ExtractArtifacts">Extract Artifacts</option>
        </select>
        <select id="map-theme">
          <option value="default">Default</option>
          <option value="industrial">Industrial</option>
        </select>
        <select id="select-unit-style">
          <option value="TacticalIcons">Tactical Icons</option>
          <option value="Sprites">Sprites</option>
        </select>
        <input type="checkbox" id="toggle-fog-of-war" />
        <input type="checkbox" id="toggle-debug-overlay" />
        <input type="checkbox" id="toggle-los-overlay" />
        <input type="checkbox" id="toggle-agent-control" />
        <input type="checkbox" id="toggle-allow-tactical-pause" />
        <input type="number" id="map-width" value="10" />
        <input type="number" id="map-height" value="10" />
        <input type="range" id="map-spawn-points" value="1" />
        <div id="map-spawn-points-value"></div>
        <input type="range" id="game-speed" value="50" />
        
        <button id="btn-menu-custom"></button>
        <button id="btn-menu-campaign"></button>
        <button id="btn-menu-statistics"></button>
        <button id="btn-menu-reset"></button>
        <button id="btn-setup-back"></button>
        <button id="btn-goto-equipment"></button>
        <button id="btn-pause-toggle"></button>
        <button id="btn-give-up"></button>
        
        <div id="static-map-controls" style="display: none"></div>
        <input type="number" id="map-seed" />
      </div>
    `;

    mockContext = {
      screenManager: { goBack: vi.fn() },
      modalService: { confirm: vi.fn(), alert: vi.fn() },
      gameClient: { setTimeScale: vi.fn() },
    };

    inputBinder = new InputBinder(mockContext as AppContext);
    mockCallbacks = {
      onTogglePause: vi.fn(),
      onAbortMission: vi.fn(),
      onCustomMission: vi.fn(),
      onCampaignMenu: vi.fn(),
      onResetData: vi.fn(),
      onShowEquipment: vi.fn(),
      onLoadStaticMap: vi.fn(),
      onUploadStaticMap: vi.fn(),
      onConvertAscii: vi.fn(),
      onExportReplay: vi.fn(),
      onShowStatistics: vi.fn(),
      onSetupBack: vi.fn(),
      onUnitStyleChange: vi.fn(),
      onThemeChange: vi.fn(),
      onMapGeneratorChange: vi.fn(),
      onMissionTypeChange: vi.fn(),
      onToggleFog: vi.fn(),
      onToggleDebug: vi.fn(),
      onToggleLos: vi.fn(),
      onToggleAi: vi.fn(),
      onTogglePauseAllowed: vi.fn(),
      onMapSizeChange: vi.fn(),
    };
  });

  it("should trigger toggle callbacks when checkboxes change", () => {
    inputBinder.bindAll(mockCallbacks);
    const fogCheck = document.getElementById(
      "toggle-fog-of-war",
    ) as HTMLInputElement;
    fogCheck.checked = true;
    fogCheck.dispatchEvent(new Event("change"));
    expect(mockCallbacks.onToggleFog).toHaveBeenCalledWith(true);

    const debugCheck = document.getElementById(
      "toggle-debug-overlay",
    ) as HTMLInputElement;
    debugCheck.checked = true;
    debugCheck.dispatchEvent(new Event("change"));
    expect(mockCallbacks.onToggleDebug).toHaveBeenCalledWith(true);
  });

  it("should trigger onMapSizeChange when width changes", () => {
    inputBinder.bindAll(mockCallbacks);
    const wInput = document.getElementById("map-width") as HTMLInputElement;
    wInput.value = "16";
    wInput.dispatchEvent(new Event("input"));

    expect(mockCallbacks.onMapSizeChange).toHaveBeenCalledWith(16, 10);
  });

  it("should trigger onThemeChange when theme selector changes", () => {
    inputBinder.bindAll(mockCallbacks);
    const themeSelect = document.getElementById(
      "map-theme",
    ) as HTMLSelectElement;
    themeSelect.value = "industrial";
    themeSelect.dispatchEvent(new Event("change"));

    expect(mockCallbacks.onThemeChange).toHaveBeenCalledWith("industrial");
  });

  it("should trigger onMapGeneratorChange when generator selector changes", () => {
    inputBinder.bindAll(mockCallbacks);
    const genSelect = document.getElementById(
      "map-generator-type",
    ) as HTMLSelectElement;
    genSelect.value = MapGeneratorType.TreeShip;
    genSelect.dispatchEvent(new Event("change"));

    expect(mockCallbacks.onMapGeneratorChange).toHaveBeenCalledWith(
      MapGeneratorType.TreeShip,
    );
  });

  it("should trigger onMissionTypeChange when mission selector changes", () => {
    inputBinder.bindAll(mockCallbacks);
    const missionSelect = document.getElementById(
      "mission-type",
    ) as HTMLSelectElement;
    missionSelect.value = MissionType.ExtractArtifacts;
    missionSelect.dispatchEvent(new Event("change"));

    expect(mockCallbacks.onMissionTypeChange).toHaveBeenCalledWith(
      MissionType.ExtractArtifacts,
    );
  });
});
