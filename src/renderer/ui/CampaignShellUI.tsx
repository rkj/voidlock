import { createElement, Fragment } from "@src/renderer/jsx";
import { CampaignTabId, CampaignShellMode } from "./CampaignShell";

interface TopBarProps {
  mode: CampaignShellMode;
  activeTabId: CampaignTabId;
  showTabs: boolean;
  state: any; // CampaignState | null
  activeMissionType: string | null;
  onTabChange: (tabId: CampaignTabId) => void;
  onMenu: () => void;
}

export function CampaignShellTopBar({
  mode,
  activeTabId,
  showTabs,
  state,
  activeMissionType,
  onTabChange,
  onMenu
}: TopBarProps) {
  const scrap = state?.scrap ?? 0;
  const intel = state?.intel ?? 0;
  const currentSector = state?.currentSector ?? 1;

  return (
    <div id="campaign-shell-top-bar" class="campaign-top-bar flex-row justify-between align-center" style={{ padding: "0 10px", flexWrap: "wrap" }}>
      <div class="flex-col" style={{ flexShrink: "0" }}>
        {mode === "campaign" && (
          <Fragment>
            <div style={{ fontSize: "0.7em", color: "var(--color-text-dim)", letterSpacing: "1px" }}>Active Contract</div>
            <div style={{ fontSize: "0.9em", fontWeight: "bold", color: "var(--color-primary)" }}>
              {state ? `Sector ${currentSector}` : "New Authorization"}
            </div>
          </Fragment>
        )}
        {mode === "statistics" && (
          <Fragment>
            <div style={{ fontSize: "0.7em", color: "var(--color-text-dim)", letterSpacing: "1px" }}>Operational Logs</div>
            <div style={{ fontSize: "0.9em", fontWeight: "bold", color: "var(--color-primary)" }}>Asset Statistics</div>
          </Fragment>
        )}
        {mode === "custom" && (
          <Fragment>
            <div style={{ fontSize: "0.7em", color: "var(--color-text-dim)", letterSpacing: "1px" }}>Simulated Operation</div>
            <div style={{ fontSize: "0.9em", fontWeight: "bold", color: "var(--color-primary)" }}>Simulation Protocol</div>
          </Fragment>
        )}
        {mode === "global" && (
          <Fragment>
            <div style={{ fontSize: "0.7em", color: "var(--color-text-dim)", letterSpacing: "1px" }}>Terminal</div>
            <div style={{ fontSize: "0.9em", fontWeight: "bold", color: "var(--color-primary)" }}>Global Configuration</div>
          </Fragment>
        )}
      </div>

      <div class="shell-controls-right flex-row align-center gap-20" style={{ flexShrink: "1", minWidth: "0", overflow: "visible", maxWidth: "100%" }}>
        {mode === "campaign" && state && (
          <div class="shell-resources flex-row gap-15" style={window.innerWidth < 600 ? { display: "none" } : {}}>
            <div class="resource-item" title="Credits (Currency)">
              <span style={{ color: "var(--color-text-dim)" }}>Credits:</span>
              <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{scrap}</span>
            </div>
            <div class="resource-item" title="Intel (Tech/Unlock)">
              <span style={{ color: "var(--color-text-dim)" }}>Intel:</span>
              <span style={{ color: "var(--color-accent)", fontWeight: "bold" }}>{intel}</span>
            </div>
          </div>
        )}

        <div class="shell-tabs flex-row gap-5" style={{ overflowX: "auto", flexShrink: "0", minWidth: "0", maxWidth: "100%", scrollbarWidth: "none" }}>
          {showTabs && renderTabs(mode, state, activeTabId, activeMissionType, onTabChange)}
        </div>

        {mode !== "none" && (
          <button 
            class="back-button" 
            style={{ margin: "0", padding: "5px 12px", height: "32px", fontSize: "0.85em", display: "flex", alignItems: "center", flexShrink: "0" }}
            onClick={onMenu}
          >
            Main Menu
          </button>
        )}
      </div>
    </div>
  );
}

interface FooterProps {
  metaStats: any;
  syncStatus: "synced" | "syncing" | "local-only";
}

export function CampaignShellFooter({ metaStats, syncStatus }: FooterProps) {
  const isMobile = window.innerWidth < 600;

  return (
    <div id="campaign-shell-footer" class="campaign-footer flex-row align-center gap-20" style={{
      background: "rgba(0, 0, 0, 0.6)",
      backdropFilter: "blur(4px)",
      borderTop: "1px solid var(--color-border)",
      fontSize: "0.7em",
      color: "var(--color-text-dim)",
      padding: "4px 10px",
      pointerEvents: "none",
      boxSizing: "border-box",
      height: "28px",
      flexShrink: "0",
      overflow: "hidden",
      flexWrap: "nowrap"
    }}>

      <div class="flex-row gap-5" style={{ alignItems: "center", flexShrink: "0" }}>
        <span style={{ letterSpacing: "1px", opacity: "0.7" }}>{isMobile ? "Kills:" : "Total Biological Neutralizations:"}</span>
        <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{metaStats.totalKills.toLocaleString()}</span>
      </div>
      <div class="flex-row gap-5" style={{ alignItems: "center", flexShrink: "0" }}>
        <span style={{ letterSpacing: "1px", opacity: "0.7" }}>{isMobile ? "Contracts:" : "Active Contracts:"}</span>
        <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{metaStats.totalCampaignsStarted.toLocaleString()}</span>
      </div>
      <div class="flex-row gap-5" style={{ alignItems: "center", flexShrink: "0" }}>
        <span style={{ letterSpacing: "1px", opacity: "0.7" }}>{isMobile ? "Wins:" : "Operations Closed:"}</span>
        <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{metaStats.totalMissionsWon.toLocaleString()}</span>
      </div>
      
      <div class="flex-grow"></div>

      <SyncStatusUI syncStatus={syncStatus} />
    </div>
  );
}

function renderTabs(
  mode: CampaignShellMode,
  state: any,
  activeTabId: CampaignTabId,
  activeMissionType: string | null,
  onTabChange: (tabId: CampaignTabId) => void
) {
  const tabs: { id: CampaignTabId; label: string }[] = [];

  if (mode === "campaign" && state) {
    const currentNode = state.currentNodeId
      ? state.nodes.find((n: any) => n.id === state.currentNodeId)
      : null;
    const isShop = currentNode?.type === "Shop";
    const isPrologue =
      activeMissionType === "Prologue" ||
      currentNode?.missionType === "Prologue";
    const isMission2 = state.history?.length === 1;

    if (isPrologue || isMission2) {
      tabs.push({ id: "ready-room", label: "Asset Management Hub" });
    } else {
      tabs.push({ id: "sector-map", label: "Operational Map" });
      tabs.push({ id: "ready-room", label: isShop ? "Procurement Hub" : "Asset Management Hub" });
      tabs.push({ id: "engineering", label: "System Engineering" });
      tabs.push({ id: "stats", label: "Asset Logs" });
      tabs.push({ id: "settings", label: "Terminal" });
    }
  } else if (mode === "statistics") {
    tabs.push({ id: "stats", label: "Asset Logs" });
    tabs.push({ id: "engineering", label: "System Engineering" });
  } else if (mode === "custom") {
    tabs.push({ id: "setup", label: "Protocol" });
    tabs.push({ id: "stats", label: "Asset Logs" });
    tabs.push({ id: "settings", label: "Terminal" });
  }

  return tabs.map(tab => (
    <button
      class={`tab-button shell-tab ${activeTabId === tab.id ? "active" : ""}`}
      data-id={tab.id}
      style={{ padding: "5px 12px", height: "32px", fontSize: "0.85em", display: "flex", alignItems: "center" }}
      onClick={() => onTabChange(tab.id)}
    >
      {tab.label}
    </button>
  ));
}

function SyncStatusUI({ syncStatus }: { syncStatus: "synced" | "syncing" | "local-only" }) {
  let icon = "💾";
  let text = "Local Only";
  let className = "local";

  if (syncStatus === "synced") {
    icon = "☁️";
    text = "Cloud Synced";
    className = "synced";
  } else if (syncStatus === "syncing") {
    icon = "🔄";
    text = "Syncing...";
    className = "syncing";
  }

  return (
    <div id="sync-status-indicator" class={`sync-status ${className}`} title={`Data Storage Status: ${text}`}>
      <span class="sync-icon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
