import { AdvisorMessage } from "@src/renderer/controllers/TutorialManager";
import { GameClient } from "@src/engine/GameClient";
import { Logger } from "@src/shared/Logger";
import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import advisorStylesUrl from "@src/styles/advisor.css?url";

export class AdvisorOverlay {
  private container: HTMLElement;
  private gameClient: GameClient;

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
    Logger.info(`Advisor showing message: ${msg.id}`);
    
    const messageEl = document.createElement("div");
    messageEl.className = "advisor-message";
    if (msg.duration) {
        messageEl.classList.add("advisor-toast");
    }
    if (msg.title || msg.illustration) {
        messageEl.classList.add("advisor-narrative-modal");
    }

    const portrait = msg.portrait || "logo_gemini.webp"; // fallback
    const portraitUrl = `assets/${portrait}`;
    const illustrationUrl = msg.illustration ? `assets/${msg.illustration}` : null;

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
        const backdrop = document.createElement("div");
        backdrop.className = "advisor-modal-backdrop";
        backdrop.appendChild(messageEl);
        document.body.appendChild(backdrop);

        const dismiss = () => {
            InputDispatcher.getInstance().popContext(`advisor-${msg.id}`);
            backdrop.remove();
            this.gameClient.resume();
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
