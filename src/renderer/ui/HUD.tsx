import { createElement } from "@src/renderer/jsx";

export function HUDTutorialDirective() {
  return (
    <div id="tutorial-directive" class="tutorial-directive-container">
      <span id="tutorial-directive-text"></span>
    </div>
  );
}

export function HUDTopBar() {
  return (
    <div id="top-bar" class="top-bar">
      <button id="btn-toggle-squad" class="drawer-toggle">Roster</button>
      <div id="game-status">
        Time: <span class="time-value" data-bind-text="t" data-bind-transform="toSeconds">0.0</span>s
      </div>
      
      <div
        id="top-threat-container"
        data-bind-visibility="stats"
        data-bind-transform="threatVisibility"
        data-bind-class="missionType|threatDimmed"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexGrow: "1",
          justifyContent: "center",
          maxWidth: "450px",
          margin: "0 20px"
        }}
      >
        <span
          style={{
            fontSize: "0.8em",
            color: "var(--color-text-dim)",
            whiteSpace: "nowrap",
            letterSpacing: "1px"
          }}
        >
          Swarm Activity Index
        </span>
        <div id="top-threat-bar" class="threat-bar">
          {/* Robust Flex-based Dividers every 10% */}
          <div
            style={{
              position: "absolute",
              inset: "0",
              display: "flex",
              pointerEvents: "none",
              zIndex: "1"
            }}
          >
            <div style={{ width: "10%", height: "100%", borderRight: "1px solid #666", boxSizing: "border-box" }}></div>
            <div style={{ width: "10%", height: "100%", borderRight: "1px solid #666", boxSizing: "border-box" }}></div>
            <div style={{ width: "10%", height: "100%", borderRight: "1px solid #666", boxSizing: "border-box" }}></div>
            <div style={{ width: "10%", height: "100%", borderRight: "1px solid #666", boxSizing: "border-box" }}></div>
            <div style={{ width: "10%", height: "100%", borderRight: "1px solid #666", boxSizing: "border-box" }}></div>
            <div style={{ width: "10%", height: "100%", borderRight: "1px solid #666", boxSizing: "border-box" }}></div>
            <div style={{ width: "10%", height: "100%", borderRight: "1px solid #666", boxSizing: "border-box" }}></div>
            <div style={{ width: "10%", height: "100%", borderRight: "1px solid #666", boxSizing: "border-box" }}></div>
            <div style={{ width: "10%", height: "100%", borderRight: "1px solid #666", boxSizing: "border-box" }}></div>
            <div style={{ width: "10%", height: "100%", boxSizing: "border-box" }}></div>
          </div>
          <div 
            id="top-threat-fill" 
            class="threat-fill" 
            data-bind-style-width="stats.threatLevel" 
            data-bind-class="stats.threatLevel|threatFillClass"
          ></div>
        </div>
        <span
          id="top-threat-value"
          data-bind-text="stats.threatLevel|threatPercent"
          data-bind-class="stats.threatLevel|threatValueClass"
          style={{
            fontSize: "0.8em",
            color: "var(--color-success)",
            minWidth: "40px",
            fontWeight: "bold"
          }}
        >
          0%
        </span>
      </div>

      <button id="btn-toggle-right" class="drawer-toggle">Targets</button>

      {/* Speed Control */}
      <div id="speed-control" data-bind-visibility="settings" data-bind-transform="speedVisibility" data-bind-class="missionType|speedDimmed">
        <button id="btn-pause-toggle" data-bind-text="settings.isPaused" data-bind-transform="pauseText">|| Pause</button>
        <label for="game-speed">Speed</label>
        <input
          type="range"
          id="game-speed"
          min="0"
          max="100"
          step="1"
          value="50"
          data-bind-value="settings.targetTimeScale"
          data-bind-transform="speedSlider"
          data-bind-min="settings.allowTacticalPause|minSpeedValue"
          style={{ width: "80px", margin: "0" }}
          title="Game Speed (0.1x to 10.0x)"
        />
        <span id="speed-value" data-bind-text="settings" data-bind-transform="speedText">1.0x</span>
      </div>

      <button
        id="btn-give-up"
        style={{
          backgroundColor: "#442222",
          borderColor: "#ff4444",
          color: "#ffcccc",
          marginLeft: "10px"
        }}
      >
        Abort Operation
      </button>
    </div>
  );
}

export function HUDSoldierPanel() {
  return (
    <div id="soldier-panel" class="soldier-panel" data-bind-class="missionType|soldierPanelDimmed">
      <div id="soldier-list">
        {/* Soldier cards injected here */}
      </div>
    </div>
  );
}

export function HUDRightPanel() {
  return (
    <div id="right-panel" class="right-panel" data-bind-class="missionType|rightPanelDimmed">
      {/* Commands and Objectives will be injected here */}
    </div>
  );
}

export function HUDMobileActionPanel() {
  return (
    <div id="mobile-action-panel" class="mobile-only">
      {/* Commands and Deployment will be injected here on mobile */}
    </div>
  );
}
