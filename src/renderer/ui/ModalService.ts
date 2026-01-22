export interface ModalOptions {
  title?: string;
  message?: string;
  content?: HTMLElement | ((instance: ModalInstance) => HTMLElement);
  buttons?: ModalButton[];
  onClose?: () => void;
  zIndex?: number;
}

export interface ModalButton {
  label: string;
  className?: string;
  onClick: (modal: ModalInstance) => void;
  isPrimary?: boolean;
  isCancel?: boolean;
}

export interface ModalInstance {
  close: (value?: any) => void;
}

export class ModalService {
  private container: HTMLElement;
  private queue: Array<{
    options: ModalOptions;
    resolve: (value: any) => void;
  }> = [];
  private activeModal: {
    options: ModalOptions;
    element: HTMLElement;
    backdrop: HTMLElement;
    resolve: (value: any) => void;
    instance: ModalInstance;
  } | null = null;

  constructor() {
    let container = document.getElementById("modal-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "modal-container";
      document.body.appendChild(container);
    }
    this.container = container;

    window.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  public async alert(message: string, title: string = "ALERT"): Promise<void> {
    return this.show({
      title,
      message,
      buttons: [
        {
          label: "OK",
          isPrimary: true,
          onClick: (modal) => modal.close(),
        },
      ],
    });
  }

  public async confirm(
    message: string,
    title: string = "CONFIRM",
  ): Promise<boolean> {
    return this.show({
      title,
      message,
      buttons: [
        {
          label: "CANCEL",
          isCancel: true,
          onClick: (modal) => modal.close(false),
        },
        {
          label: "OK",
          isPrimary: true,
          onClick: (modal) => modal.close(true),
        },
      ],
    });
  }

  public async prompt(
    message: string,
    defaultValue: string = "",
    title: string = "INPUT",
  ): Promise<string | null> {
    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    input.className = "modal-prompt-input";
    input.style.width = "100%";
    input.style.marginTop = "10px";
    input.style.padding = "8px";
    input.style.background = "rgba(0,0,0,0.3)";
    input.style.border = "1px solid var(--color-border)";
    input.style.color = "var(--color-text)";

    return this.show({
      title,
      message,
      content: input,
      buttons: [
        {
          label: "CANCEL",
          isCancel: true,
          onClick: (modal) => modal.close(null),
        },
        {
          label: "OK",
          isPrimary: true,
          onClick: (modal) => modal.close(input.value),
        },
      ],
    });
  }

  public show(options: ModalOptions): Promise<any> {
    return new Promise((resolve) => {
      this.queue.push({ options, resolve });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.activeModal || this.queue.length === 0) return;

    const { options, resolve } = this.queue.shift()!;
    this.renderModal(options, resolve);
  }

  private renderModal(options: ModalOptions, resolve: (value: any) => void) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.style.position = "fixed";
    backdrop.style.inset = "0";
    backdrop.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
    backdrop.style.zIndex = (options.zIndex || 2000).toString();
    backdrop.style.backdropFilter = "blur(4px)";
    backdrop.style.display = "flex";
    backdrop.style.alignItems = "center";
    backdrop.style.justifyContent = "center";

    const modal = document.createElement("div");
    modal.className = "modal-window flex-col gap-20 p-40";
    modal.style.backgroundColor = "var(--color-surface-elevated)";
    modal.style.border = "2px solid var(--color-primary)";
    modal.style.minWidth = "300px";
    modal.style.maxWidth = "80vw";
    modal.style.boxShadow = "0 0 30px rgba(0, 255, 0, 0.1)";
    modal.style.animation = "modal-fade-in 0.2s ease-out";

    if (options.title) {
      const titleElement = document.createElement("h2");
      titleElement.textContent = options.title.toUpperCase();
      titleElement.style.margin = "0";
      titleElement.style.color = "var(--color-primary)";
      titleElement.style.letterSpacing = "2px";
      titleElement.style.borderBottom = "1px solid var(--color-border)";
      titleElement.style.paddingBottom = "10px";
      modal.appendChild(titleElement);
    }

    if (options.message) {
      const messageElement = document.createElement("p");
      messageElement.textContent = options.message;
      messageElement.style.lineHeight = "1.6";
      messageElement.style.fontSize = "1.1em";
      modal.appendChild(messageElement);
    }

    const instance: ModalInstance = {
      close: (value?: any) => {
        if (this.activeModal && this.activeModal.element === modal) {
          this.container.removeChild(backdrop);
          const currentResolve = this.activeModal.resolve;
          this.activeModal = null;
          if (options.onClose) options.onClose();
          currentResolve(value);
          this.processQueue();
        }
      },
    };

    if (options.content) {
      if (typeof options.content === "function") {
        modal.appendChild(options.content(instance));
      } else {
        modal.appendChild(options.content);
      }
    }

    if (options.buttons && options.buttons.length > 0) {
      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "flex-row gap-10 justify-center";
      buttonsContainer.style.marginTop = "10px";

      options.buttons.forEach((btnOptions) => {
        const btn = document.createElement("button");
        btn.textContent = btnOptions.label;
        if (btnOptions.className) {
          btn.className = btnOptions.className;
        } else if (btnOptions.isPrimary) {
          btn.className = "primary-button";
        }

        btn.onclick = () => btnOptions.onClick(instance);
        buttonsContainer.appendChild(btn);
      });
      modal.appendChild(buttonsContainer);
    }

    backdrop.appendChild(modal);
    this.container.appendChild(backdrop);
    this.activeModal = { options, element: modal, backdrop, resolve, instance };

    // Focus management
    const input = modal.querySelector("input") as HTMLElement;
    if (input) {
      input.focus();
    } else {
      const primaryBtn = modal.querySelector(".primary-button") as HTMLElement;
      if (primaryBtn) {
        primaryBtn.focus();
      } else {
        const firstBtn = modal.querySelector("button") as HTMLElement;
        if (firstBtn) firstBtn.focus();
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.activeModal) return;

    const { options, instance } = this.activeModal;

    if (e.key === "Escape") {
      const cancelBtn = options.buttons?.find((b) => b.isCancel);
      if (cancelBtn) {
        cancelBtn.onClick(instance);
      } else {
        instance.close();
      }
      e.preventDefault();
    } else if (e.key === "Enter") {
      const primaryBtn = options.buttons?.find((b) => b.isPrimary);
      if (primaryBtn) {
        primaryBtn.onClick(instance);
        e.preventDefault();
      }
    }
  }
}
