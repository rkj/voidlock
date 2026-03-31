import { createElement, Fragment } from "@src/renderer/jsx";
import type { CampaignTabId, CampaignShellMode } from "./CampaignShell";
import type { CampaignState, MetaStats } from "@src/shared/campaign_types";
import { t } from "../i18n";
import { I18nKeys } from "../i18n/keys";

interface TopBarProps {
  mode: CampaignShellMode;
  activeTabId: CampaignTabId;
  showTabs: boolean;
  state: CampaignState | null;
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
            <div style={{ fontSize: "0.7em", color: "var(--color-text-dim)", letterSpacing: "1px" }}>{t(I18nKeys.hud.shell.active_contract)}</div>
            <div style={{ fontSize: "0.9em", fontWeight: "bold", color: "var(--color-primary)" }}>
              {state ? t(I18nKeys.hud.shell.sector, { sector: currentSector }) : t(I18nKeys.hud.shell.new_authorization)}
            </div>
          </Fragment>
        )}
        {mode === "statistics" && (
          <Fragment>
            <div style={{ fontSize: "0.7em", color: "var(--color-text-dim)", letterSpacing: "1px" }}>{t(I18nKeys.hud.shell.operational_logs)}</div>
            <div style={{ fontSize: "0.9em", fontWeight: "bold", color: "var(--color-primary)" }}>{t(I18nKeys.hud.shell.asset_statistics)}</div>
          </Fragment>
        )}
        {mode === "custom" && (
          <Fragment>
            <div style={{ fontSize: "0.7em", color: "var(--color-text-dim)", letterSpacing: "1px" }}>{t(I18nKeys.hud.shell.simulated_operation)}</div>
            <div style={{ fontSize: "0.9em", fontWeight: "bold", color: "var(--color-primary)" }}>{t(I18nKeys.hud.shell.simulation_protocol)}</div>
          </Fragment>
        )}
        {mode === "global" && (
          <Fragment>
            <div style={{ fontSize: "0.7em", color: "var(--color-text-dim)", letterSpacing: "1px" }}>{t(I18nKeys.hud.shell.terminal)}</div>
            <div style={{ fontSize: "0.9em", fontWeight: "bold", color: "var(--color-primary)" }}>{t(I18nKeys.hud.shell.global_configuration)}</div>
          </Fragment>
        )}
      </div>

      <div class="shell-controls-right flex-row align-center gap-20" style={{ flexShrink: "1", minWidth: "0", overflow: "visible", maxWidth: "100%" }}>
        {mode === "campaign" && state && (
          <div class="shell-resources flex-row gap-15" style={window.innerWidth < 600 ? { display: "none" } : {}}>
            <div class="resource-item" title={t(I18nKeys.hud.credits)}>
              <span style={{ color: "var(--color-text-dim)" }}>{t(I18nKeys.hud.credits)}</span>
              <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{scrap}</span>
            </div>
            <div class="resource-item" title={t(I18nKeys.hud.intel)}>
              <span style={{ color: "var(--color-text-dim)" }}>{t(I18nKeys.hud.intel)}</span>
              <span style={{ color: "var(--color-accent)", fontWeight: "bold" }}>{intel}</span>
            </div>
          </div>
        )}

        <div class="shell-tabs flex-row gap-5" style={{ overflowX: "auto", flexShrink: "0", minWidth: "0", maxWidth: "100%", scrollbarWidth: "none" }}>
          {showTabs && renderTabs({ mode, state, activeTabId, activeMissionType, onTabChange })}
        </div>

        {mode !== "none" && (
          <button 
            class="back-button" 
            style={{ margin: "0", padding: "5px 12px", height: "32px", fontSize: "0.85em", display: "flex", alignItems: "center", flexShrink: "0" }}
            onClick={onMenu}
          >
            {t(I18nKeys.menu.main)}
          </button>
        )}
      </div>
    </div>
  );
}

interface FooterProps {
  metaStats: MetaStats;
  syncStatus: "synced" | "syncing" | "local-only";
}

export function CampaignShellFooter({ metaStats, syncStatus }: FooterProps) {
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
        <span style={{ letterSpacing: "1px", opacity: "0.7" }}>{t(I18nKeys.hud.kills)}</span>
        <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{metaStats.totalKills.toLocaleString()}</span>
      </div>
      <div class="flex-row gap-5" style={{ alignItems: "center", flexShrink: "0" }}>
        <span style={{ letterSpacing: "1px", opacity: "0.7" }}>{t(I18nKeys.hud.contracts)}</span>
        <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{metaStats.totalCampaignsStarted.toLocaleString()}</span>
      </div>
      <div class="flex-row gap-5" style={{ alignItems: "center", flexShrink: "0" }}>
        <span style={{ letterSpacing: "1px", opacity: "0.7" }}>{t(I18nKeys.hud.wins)}</span>
        <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{metaStats.totalMissionsWon.toLocaleString()}</span>
      </div>
      
      <div class="flex-grow"></div>

      <SyncStatusUI syncStatus={syncStatus} />
    </div>
  );
}

interface RenderTabsParams {
  mode: CampaignShellMode;
  state: CampaignState | null;
  activeTabId: CampaignTabId;
  activeMissionType: string | null;
  onTabChange: (tabId: CampaignTabId) => void;
}

function buildTabList(
  mode: CampaignShellMode,
  state: CampaignState | null,
  activeMissionType: string | null,
): { id: CampaignTabId; label: string }[] {
  if (mode === "campaign" && state) {
    return buildCampaignTabs(state, activeMissionType);
  }
  if (mode === "statistics") {
    return [
      { id: "stats", label: t(I18nKeys.hud.shell.asset_logs) },
      { id: "engineering", label: t(I18nKeys.hud.shell.system_engineering) },
    ];
  }
  if (mode === "custom") {
    return [
      { id: "setup", label: t(I18nKeys.hud.shell.protocol) },
      { id: "stats", label: t(I18nKeys.hud.shell.asset_logs) },
      { id: "settings", label: t(I18nKeys.hud.shell.terminal) },
    ];
  }
  return [];
}

function buildCampaignTabs(
  state: CampaignState,
  activeMissionType: string | null,
): { id: CampaignTabId; label: string }[] {
  const currentNode = state.currentNodeId
    ? state.nodes.find((n) => n.id === state.currentNodeId)
    : null;
  const isShop = currentNode?.type === "Shop";
  const isPrologue =
    activeMissionType === "Prologue" ||
    currentNode?.missionType === "Prologue";
  const isMission2 = state.history?.length === 1;

  if (isPrologue || isMission2) {
    return [
      { id: "sector-map", label: t(I18nKeys.hud.shell.operational_map) },
      { id: "ready-room", label: t(I18nKeys.hud.shell.asset_management_hub) }
    ];
  }
  return [
    { id: "sector-map", label: t(I18nKeys.hud.shell.operational_map) },
    { id: "ready-room", label: isShop ? t(I18nKeys.hud.shell.procurement_hub) : t(I18nKeys.hud.shell.asset_management_hub) },
    { id: "engineering", label: t(I18nKeys.hud.shell.system_engineering) },
    { id: "stats", label: t(I18nKeys.hud.shell.asset_logs) },
    { id: "settings", label: t(I18nKeys.hud.shell.terminal) },
  ];
}

function renderTabs({
  mode,
  state,
  activeTabId,
  activeMissionType,
  onTabChange,
}: RenderTabsParams) {
  const tabs = buildTabList(mode, state, activeMissionType);

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
  let text = t(I18nKeys.hud.shell.sync.local_only);
  let className = "local";

  if (syncStatus === "synced") {
    icon = "☁️";
    text = t(I18nKeys.hud.shell.sync.cloud_synced);
    className = "synced";
  } else if (syncStatus === "syncing") {
    icon = "🔄";
    text = t(I18nKeys.hud.shell.sync.syncing);
    className = "syncing";
  }

  return (
    <div id="sync-status-indicator" class={`sync-status ${className}`} title={t(I18nKeys.hud.shell.sync.status_title, { status: text })}>
      <span class="sync-icon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
