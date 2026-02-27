import { MissionReport } from "@src/shared/campaign_types";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { GameClient } from "@src/engine/GameClient";
import { UnitStyle, InputPriority } from "@src/shared/types";
import { ReplayController } from "@src/renderer/controllers/ReplayController";
import { InputDispatcher } from "../InputDispatcher";
import { UIUtils } from "../utils/UIUtils";

export class DebriefScreen {
  private container: HTMLElement;
  private gameClient: GameClient;
  private onContinue: () => void;
  private onReplay?: () => void;
  private onExport?: () => void;
  private report: MissionReport | null = null;
  private replayController: ReplayController;
  private canvas: HTMLCanvasElement | null = null;
  private playbackBtn: HTMLButtonElement | null = null;
  private progressFill: HTMLElement | null = null;
  private scrubber: HTMLInputElement | null = null;
  private unitStyle: UnitStyle = UnitStyle.TacticalIcons;

  constructor(
    containerId: string,
    gameClient: GameClient,
    onContinue: () => void,
    onReplay?: () => void,
    onExport?: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.gameClient = gameClient;
    this.onContinue = onContinue;
    this.onReplay = onReplay;
    this.onExport = onExport;
    this.replayController = new ReplayController(
      this.gameClient,
      (progress) => {
        if (this.progressFill) {
          this.progressFill.style.width = `${progress}%`;
        }
        if (this.scrubber) {
          this.scrubber.value = progress.toString();
        }
        this.updatePlaybackUI();
      },
    );
  }

  public show(
    report: MissionReport,
    unitStyle: UnitStyle = UnitStyle.TacticalIcons,
  ) {
    this.report = report;
    this.unitStyle = unitStyle;
    this.container.style.display = "flex";

    // Start replay before rendering to ensure ReplayController speed is set
    this.replayController.startReplay(this.report.timeSpent);
    this.render();

    if (this.canvas) {
      this.replayController.setRenderer(this.canvas, this.unitStyle);
    }
    this.updatePlaybackUI();
    this.pushInputContext();
  }

  public hide() {
    this.replayController.destroy();
    this.container.style.display = "none";
    this.canvas = null;
    this.playbackBtn = null;
    this.progressFill = null;
    InputDispatcher.getInstance().popContext("debrief");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
      id: "debrief",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: this.container,
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [
        {
          key: "Arrows",
          label: "Navigate",
          description: "Move selection",
          category: "Navigation",
        },
        {
          key: "Enter",
          label: "Select",
          description: "Activate button",
          category: "Navigation",
        },
      ],
    });
  }

  private handleKeyDown(e: KeyboardEvent): boolean {
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      return UIUtils.handleArrowNavigation(e, this.container);
    }
    return false;
  }

  public isVisible(): boolean {
    return this.container.style.display === "flex";
  }

  private updatePlaybackUI() {
    if (this.playbackBtn) {
      const isPaused = this.replayController.getIsPaused();
      this.playbackBtn.textContent = isPaused ? "Play" : "Pause";
    }

    const currentSpeed = this.replayController.getTargetScale();
    this.container.querySelectorAll(".replay-speed-btn").forEach((btn) => {
      const speed = parseFloat(btn.textContent || "0");
      if (speed === currentSpeed) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  private render() {
    if (!this.report) return;

    const isWon = this.report.result === "Won";

    this.container.innerHTML = "";
    this.container.className = "screen debrief-screen";
    this.container.style.display = "flex";

    const debriefContainer = document.createElement("div");
    debriefContainer.className = "debrief-container";
    this.container.appendChild(debriefContainer);

    // --- Left Pane: Summary ---
    const summary = document.createElement("div");
    summary.className = "debrief-summary";
    debriefContainer.appendChild(summary);

    // Header (Fixed)
    const headerSection = document.createElement("div");
    headerSection.className = "flex-col flex-shrink-0";
    
    const header = document.createElement("h1");
    header.textContent = isWon ? "Mission Success" : "Mission Failed";
    header.className = `debrief-header ${isWon ? "success" : "failed"}`;
    headerSection.appendChild(header);

    const subHeader = document.createElement("div");
    subHeader.textContent = isWon
      ? "All objectives completed."
      : "Squad wiped or mission aborted.";
    subHeader.className = "debrief-subheader";
    headerSection.appendChild(subHeader);
    summary.appendChild(headerSection);

    // Scrollable Content
    const scrollContent = document.createElement("div");
    scrollContent.className = "scroll-content";
    summary.appendChild(scrollContent);

    // Stats
    const statsPanel = this.createPanel("Mission Statistics");
    statsPanel.innerHTML += `
      <div class="debrief-stat-row">
        <span>Xenos Neutralized:</span>
        <span style="color:var(--color-hive); font-weight:bold;">${this.report.aliensKilled}</span>
      </div>
      <div class="debrief-stat-row">
        <span>Operation Time:</span>
        <span style="color:var(--color-accent); font-weight:bold;">${(this.report.timeSpent / 1000).toFixed(1)}s</span>
      </div>
      <div class="debrief-resource-section">
        <div class="debrief-resource-row">
          <span>Scrap Recovered:</span>
          <span style="color:var(--color-primary); font-weight:bold;">+${this.report.scrapGained}</span>
        </div>
        <div class="debrief-resource-row">
          <span>Intel Gathered:</span>
          <span style="color:var(--color-accent); font-weight:bold;">+${this.report.intelGained}</span>
        </div>
      </div>
    `;
    scrollContent.appendChild(statsPanel);

    // Squad
    const squadPanel = this.createPanel("Squad After-Action Report");
    this.report.soldierResults.forEach((res) => {
      const soldierRow = SoldierWidget.render(res, { context: "debrief" });
      squadPanel.appendChild(soldierRow);
    });
    scrollContent.appendChild(squadPanel);

    // Footer (Fixed)
    const footer = document.createElement("div");
    footer.className = "debrief-footer flex-shrink-0";

    const continueBtn = document.createElement("button");
    continueBtn.textContent = "Return to Command Bridge";
    continueBtn.className = "debrief-button";

    continueBtn.onclick = () => this.onContinue();
    footer.appendChild(continueBtn);

    if (this.report.nodeId === "custom" && this.onReplay) {
      const replayBtn = document.createElement("button");
      replayBtn.textContent = "Replay Mission";
      replayBtn.className = "debrief-button";
      replayBtn.onclick = () => this.onReplay!();
      footer.appendChild(replayBtn);
    }

    if (this.onExport) {
      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Export Recording";
      exportBtn.className = "debrief-button secondary";
      exportBtn.onclick = () => this.onExport!();
      footer.appendChild(exportBtn);
    }

    summary.appendChild(footer);

    // --- Right Pane: Replay Viewport ---
    const replayViewport = document.createElement("div");
    replayViewport.className = "debrief-replay-viewport";
    debriefContainer.appendChild(replayViewport);

    const canvasContainer = document.createElement("div");
    canvasContainer.className = "debrief-replay-canvas-container";
    replayViewport.appendChild(canvasContainer);

    this.canvas = document.createElement("canvas");
    canvasContainer.appendChild(this.canvas);

    // Playback Controls
    const controls = document.createElement("div");
    controls.className = "replay-controls";
    replayViewport.appendChild(controls);

    this.playbackBtn = document.createElement("button");
    this.playbackBtn.className = "replay-btn";
    this.updatePlaybackUI();
    this.playbackBtn.onclick = () => {
      this.replayController.togglePause();
      this.updatePlaybackUI();
    };
    controls.appendChild(this.playbackBtn);

    const loopBtn = document.createElement("button");
    loopBtn.className = "replay-btn";
    loopBtn.textContent = "Loop: Off";
    loopBtn.onclick = () => {
      const isLooping = loopBtn.classList.toggle("active");
      this.replayController.setLooping(isLooping);
      loopBtn.textContent = isLooping ? "Loop: On" : "Loop: Off";
    };
    controls.appendChild(loopBtn);

    // Speed Selector
    const speedGroup = document.createElement("div");
    speedGroup.className = "replay-speed-group";
    controls.appendChild(speedGroup);

    [1, 2, 5, 10].forEach((speed) => {
      const btn = document.createElement("button");
      btn.className = "replay-speed-btn";
      if (this.replayController.getTargetScale() === speed)
        btn.classList.add("active");
      btn.textContent = `${speed}x`;
      btn.onclick = () => {
        this.replayController.setPlaybackSpeed(speed);
        speedGroup
          .querySelectorAll(".replay-speed-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      };
      speedGroup.appendChild(btn);
    });

    // Progress Bar
    const progressContainer = document.createElement("div");
    progressContainer.className = "replay-progress-container";
    controls.appendChild(progressContainer);

    const track = document.createElement("div");
    track.className = "replay-progress-track";
    progressContainer.appendChild(track);

    this.progressFill = document.createElement("div");
    this.progressFill.className = "replay-progress-fill";
    progressContainer.appendChild(this.progressFill);

    this.scrubber = document.createElement("input");
    this.scrubber.type = "range";
    this.scrubber.className = "replay-scrubber";
    this.scrubber.min = "0";
    this.scrubber.max = "100";
    this.scrubber.step = "0.1";
    this.scrubber.value = "0";
    this.scrubber.oninput = () => {
      if (this.scrubber) {
        this.replayController.seek(parseFloat(this.scrubber.value));
      }
    };
    progressContainer.appendChild(this.scrubber);
  }

  private createPanel(title: string): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "debrief-panel";

    const h2 = document.createElement("h2");
    h2.textContent = title;
    h2.className = "stat-label debrief-panel-title";
    panel.appendChild(h2);

    return panel;
  }
}
