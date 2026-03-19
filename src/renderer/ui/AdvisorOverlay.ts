import { AdvisorMessage } from "@src/renderer/controllers/TutorialManager";
import { GameClient } from "@src/engine/GameClient";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { Logger } from "@src/shared/Logger";
import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import advisorStylesUrl from "@src/styles/advisor.css?url";

interface QueuedMessage {
  msg: AdvisorMessage;
  onDismiss?: () => void;
}

export class AdvisorOverlay {
  private container: HTMLElement;
  private gameClient: GameClient;
  private messageQueue: QueuedMessage[] = [];
  private isShowingBlockingMessage = false;

  constructor(gameClient: GameClient) {
    this.gameClient = gameClient;
    this.container = this.createContainer();
    this.injectStyles();
  }

  private createContainer(): HTMLElement {
    let container = document.getElementById("advisor-overlay-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "advisor-overlay-container";
      container.className = "advisor-overlay-container";
      document.body.appendChild(container);
    }
    return container;
  }

  private injectStyles() {
    if (!document.getElementById("advisor-styles")) {
      const link = document.createElement("link");
      link.id = "advisor-styles";
      link.rel = "stylesheet";
      link.href = advisorStylesUrl;
      document.head.appendChild(link);
    }
  }

  public showMessage(msg: AdvisorMessage, onDismiss?: () => void) {
    if (msg.blocking) {
      if (this.isShowingBlockingMessage) {
        Logger.info(`Advisor queueing blocking message: ${msg.id}`);
        this.messageQueue.push({ msg, onDismiss });
        return;
      }
      this.isShowingBlockingMessage = true;
    }

    this.renderMessage(msg, () => {
      if (onDismiss) onDismiss();
      if (msg.blocking) {
        this.isShowingBlockingMessage = false;
        this.processQueue();
      }
    });
  }

  private processQueue() {
    if (this.messageQueue.length > 0 && !this.isShowingBlockingMessage) {
      const next = this.messageQueue.shift()!;
      this.showMessage(next.msg, next.onDismiss);
    }
  }

  private renderMessage(msg: AdvisorMessage, onDismiss?: () => void) {
    Logger.info(`Advisor showing message: ${msg.id}`);
    
    const messageEl = document.createElement("div");
    messageEl.className = "advisor-message";
    if (msg.duration) {
        messageEl.classList.add("advisor-toast");
    }
    if (msg.title || msg.illustration) {
        messageEl.classList.add("advisor-narrative-modal");
    }

    const theme = ThemeManager.getInstance();
    const portrait = msg.portrait || "logo_gemini"; // logical name fallback
    let portraitUrl = theme.getAssetUrl(portrait);
    if (!portraitUrl && portrait.includes(".")) {
      portraitUrl = `assets/${portrait}`; // Backward compatibility
    }
    if (!portraitUrl) {
      portraitUrl = `assets/logo_gemini.webp`; // Absolute fallback
    }
    
    let illustrationUrl = msg.illustration ? theme.getAssetUrl(msg.illustration) : null;
    if (!illustrationUrl && msg.illustration && msg.illustration.includes(".")) {
      illustrationUrl = `assets/${msg.illustration}`; // Backward compatibility
    }

    const hasDismissBtn = msg.blocking || (!msg.duration);

    messageEl.innerHTML = `
      ${msg.illustration ? `
        <div class="advisor-illustration">
          <img src="${illustrationUrl}" alt="Illustration">
        </div>
      ` : ""}
      <div class="advisor-header">
        <div class="advisor-portrait">
          <img src="${portraitUrl}" alt="Advisor">
        </div>
        ${msg.title ? `<div class="advisor-title">${msg.title}</div>` : ""}
      </div>
      <div class="advisor-content">
        <div class="advisor-text">${msg.text}</div>
        ${hasDismissBtn ? `
          <div class="advisor-controls">
            <button class="advisor-btn" data-id="dismiss">${msg.blocking ? "Continue" : "Dismiss"}</button>
          </div>
        ` : ""}
      </div>
    `;

    if (msg.blocking) {
        this.gameClient.freezeForDialog();
        const backdrop = document.createElement("div");
        backdrop.className = "advisor-modal-backdrop";
        backdrop.setAttribute("data-msg-id", msg.id);
        backdrop.appendChild(messageEl);
        document.body.appendChild(backdrop);

        const dismiss = () => {
            InputDispatcher.getInstance().popContext(`advisor-${msg.id}`);
            backdrop.remove();
            this.gameClient.unfreezeAfterDialog();
            Logger.info(`Advisor message dismissed: ${msg.id}`);
            if (onDismiss) onDismiss();
        };

        const btn = messageEl.querySelector(".advisor-btn");
        if (btn) {
            btn.addEventListener("click", dismiss);
        }

        InputDispatcher.getInstance().pushContext({
            id: `advisor-${msg.id}`,
            priority: InputPriority.Overlay,
            trapsFocus: true,
            container: messageEl,
            handleKeyDown: (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    dismiss();
                    return true;
                }
                return false;
            },
            getShortcuts: () => [{
                key: "Enter",
                label: "Continue",
                description: "Dismiss advisor message",
                category: "Navigation"
            }]
        });
    } else {
        this.container.appendChild(messageEl);
        
        if (hasDismissBtn) {
            const btn = messageEl.querySelector(".advisor-btn");
            if (btn) {
                btn.addEventListener("click", () => {
                    messageEl.remove();
                    Logger.info(`Advisor toast dismissed: ${msg.id}`);
                    if (onDismiss) onDismiss();
                });
            }
        }

        if (msg.duration) {
            setTimeout(() => {
                messageEl.classList.add("hiding");
                setTimeout(() => messageEl.remove(), 500);
            }, msg.duration);
        }
    }
  }
}
