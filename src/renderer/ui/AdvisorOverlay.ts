import type { AdvisorMessage } from "@src/renderer/controllers/TutorialManager";
import type { GameClient } from "@src/engine/GameClient";
import type { ThemeManager } from "@src/renderer/ThemeManager";
import { Logger } from "@src/shared/Logger";
import type { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { t } from "../i18n";
import { I18nKeys } from "../i18n/keys";
import advisorStylesUrl from "@src/styles/advisor.css?url";

interface QueuedMessage {
  msg: AdvisorMessage;
  onDismiss?: () => void;
}

export class AdvisorOverlay {
  private container: HTMLElement;
  private messageQueue: QueuedMessage[] = [];
  private isShowingBlockingMessage = false;

  constructor(
    private gameClient: GameClient,
    private themeManager: ThemeManager,
    private inputDispatcher: InputDispatcher,
  ) {
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
      const next = this.messageQueue.shift();
      if (next) this.showMessage(next.msg, next.onDismiss);
    }
  }

  private buildMessageElement(msg: AdvisorMessage): HTMLElement {
    const messageEl = document.createElement("div");
    messageEl.className = "advisor-message";
    if (msg.duration) messageEl.classList.add("advisor-toast");
    if (msg.title || msg.illustration) messageEl.classList.add("advisor-narrative-modal");

    const portrait = msg.portrait || "logo_gemini";
    let portraitUrl = this.themeManager.getAssetUrl(portrait);
    if (!portraitUrl && portrait.includes(".")) portraitUrl = `assets/${portrait}`;
    if (!portraitUrl) portraitUrl = `assets/logo_gemini.webp`;

    let illustrationUrl = msg.illustration ? this.themeManager.getAssetUrl(msg.illustration) : null;
    if (!illustrationUrl && msg.illustration?.includes(".")) illustrationUrl = `assets/${msg.illustration}`;

    const hasDismissBtn = msg.blocking || (!msg.duration);
    const btnLabel = msg.blocking ? t(I18nKeys.common.continue) : t(I18nKeys.common.dismiss);

    messageEl.innerHTML = `
      ${msg.illustration ? `<div class="advisor-illustration"><img src="${illustrationUrl}" alt="${t(I18nKeys.common.illustration)}"></div>` : ""}
      <div class="advisor-header">
        <div class="advisor-portrait"><img src="${portraitUrl}" alt="${t(I18nKeys.common.advisor)}"></div>
        ${msg.title ? `<div class="advisor-title">${msg.title}</div>` : ""}
      </div>
      <div class="advisor-content">
        <div class="advisor-text">${msg.text}</div>
        ${hasDismissBtn ? `<div class="advisor-controls"><button class="advisor-btn" data-id="dismiss">${btnLabel}</button></div>` : ""}
      </div>
    `;
    return messageEl;
  }

  private renderBlockingMessage(msg: AdvisorMessage, messageEl: HTMLElement, onDismiss?: () => void) {
    this.gameClient.freezeForDialog();
    const backdrop = document.createElement("div");
    backdrop.className = "advisor-modal-backdrop";
    backdrop.setAttribute("data-msg-id", msg.id);
    backdrop.appendChild(messageEl);
    document.body.appendChild(backdrop);

    const dismiss = () => {
      this.inputDispatcher.popContext(`advisor-${msg.id}`);
      backdrop.remove();
      this.gameClient.unfreezeAfterDialog();
      Logger.info(`Advisor message dismissed: ${msg.id}`);
      if (onDismiss) onDismiss();
    };

    messageEl.querySelector(".advisor-btn")?.addEventListener("click", dismiss);

    this.inputDispatcher.pushContext({
      id: `advisor-${msg.id}`,
      priority: InputPriority.Overlay,
      trapsFocus: true,
      container: messageEl,
      handleKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") { dismiss(); return true; }
        return false;
      },
      getShortcuts: () => [{ key: "Enter", label: t(I18nKeys.common.continue), description: "Dismiss advisor message", category: "Navigation" }],
    });
  }

  private renderToastMessage(msg: AdvisorMessage, messageEl: HTMLElement, onDismiss?: () => void) {
    const hasDismissBtn = !msg.duration;
    this.container.appendChild(messageEl);

    if (hasDismissBtn) {
      messageEl.querySelector(".advisor-btn")?.addEventListener("click", () => {
        messageEl.remove();
        Logger.info(`Advisor toast dismissed: ${msg.id}`);
        if (onDismiss) onDismiss();
      });
    }

    if (msg.duration) {
      setTimeout(() => {
        messageEl.classList.add("hiding");
        setTimeout(() => messageEl.remove(), 500);
      }, msg.duration);
    }
  }

  private renderMessage(msg: AdvisorMessage, onDismiss?: () => void) {
    Logger.info(`Advisor showing message: ${msg.id}`);
    const messageEl = this.buildMessageElement(msg);

    if (msg.blocking) {
      this.renderBlockingMessage(msg, messageEl, onDismiss);
    } else {
      this.renderToastMessage(msg, messageEl, onDismiss);
    }
  }
}
