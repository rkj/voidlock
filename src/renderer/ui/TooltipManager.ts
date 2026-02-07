export class TooltipManager {
  private static instance: TooltipManager;
  private activeTooltip: HTMLElement | null = null;
  private activeTarget: HTMLElement | null = null;

  private constructor() {
    document.addEventListener("click", (e) => this.handleInteraction(e));
    document.addEventListener("touchstart", (e) => this.handleInteraction(e), {
      passive: false,
    });
  }

  public static getInstance(): TooltipManager {
    if (!TooltipManager.instance) {
      TooltipManager.instance = new TooltipManager();
    }
    return TooltipManager.instance;
  }

  private handleInteraction(e: Event) {
    // Only handle if it's a touch device or we want to support click-to-inspect
    const isTouch =
      e.type === "touchstart" ||
      document.body.classList.contains("mobile-touch");
    if (!isTouch) return;

    const target = e.target as HTMLElement;
    const tooltipTarget = target.closest("[data-tooltip]") as HTMLElement;

    if (tooltipTarget) {
      // If we clicked the same target, toggle it off
      if (this.activeTarget === tooltipTarget) {
        this.dismiss();
        e.preventDefault();
        return;
      }

      // Show new tooltip
      this.show(tooltipTarget);
      e.preventDefault();
      e.stopPropagation();
    } else if (this.activeTooltip && !this.activeTooltip.contains(target)) {
      // Clicked outside active tooltip
      this.dismiss();
    }
  }

  private show(target: HTMLElement) {
    this.dismiss();

    const text = target.getAttribute("data-tooltip");
    if (!text) return;

    const popover = document.createElement("div");
    popover.className = "inspect-popover";
    popover.textContent = text;

    document.body.appendChild(popover);

    const rect = target.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    let top = rect.top - popoverRect.height - 10;
    let left = rect.left + rect.width / 2 - popoverRect.width / 2;

    // Boundary checks
    if (top < 10) top = rect.bottom + 10;
    if (left < 10) left = 10;
    if (left + popoverRect.width > window.innerWidth - 10) {
      left = window.innerWidth - popoverRect.width - 10;
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    this.activeTooltip = popover;
    this.activeTarget = target;
    target.classList.add("inspecting");
  }

  private dismiss() {
    if (this.activeTooltip) {
      this.activeTooltip.remove();
      this.activeTooltip = null;
    }
    if (this.activeTarget) {
      this.activeTarget.classList.remove("inspecting");
      this.activeTarget = null;
    }
  }
}
