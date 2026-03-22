export class UIUtils {
  /**
   * Handles arrow key navigation within a container's focusable elements.
   * Uses geometric 2D navigation for more efficient and distinct behavior.
   * @returns true if the event was handled (focus changed)
   */
  public static handleArrowNavigation(
    e: KeyboardEvent,
    container: HTMLElement,
    options: {
      orientation?: "horizontal" | "vertical" | "both";
      wrap?: boolean;
    } = {},
  ): boolean {
    const orientation = options.orientation || "both";
    const wrap = options.wrap ?? true;

    if (!UIUtils.isRelevantKey(e.key, orientation)) return false;

    const focusableElements = UIUtils.getFocusableElements(container);
    if (focusableElements.length === 0) return false;

    const active = document.activeElement as HTMLElement;
    if (!active || !container.contains(active)) {
      focusableElements[0].focus();
      return true;
    }

    const currentCenter = UIUtils.getElementCenter(active);
    const best = UIUtils.findBestElement(e.key, focusableElements, active, currentCenter);

    if (best) {
      best.focus();
      return true;
    }

    if (wrap) {
      return UIUtils.handleWrapNavigation(e.key, focusableElements, active);
    }

    return false;
  }

  private static isRelevantKey(key: string, orientation: string): boolean {
    if (orientation === "vertical") {
      return key !== "ArrowLeft" && key !== "ArrowRight";
    }
    if (orientation === "horizontal") {
      return key !== "ArrowUp" && key !== "ArrowDown";
    }
    return true;
  }

  private static getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'button:not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([tabindex="-1"]), select:not([tabindex="-1"]), textarea:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      const control = el as unknown as { disabled?: boolean };
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !control.disabled
      );
    });
  }

  private static getElementCenter(el: HTMLElement): { x: number; y: number } {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  private static calcDirectionScore(params: {
    key: string;
    dx: number;
    dy: number;
    center: { x: number; y: number };
    currentCenter: { x: number; y: number };
  }): number | null {
    const { key, dx, dy, center, currentCenter } = params;
    const AXIAL_WEIGHT = 1;
    const LATERAL_WEIGHT = 2;
    switch (key) {
      case "ArrowRight":
        if (center.x > currentCenter.x + 2) {
          return Math.abs(dx) * AXIAL_WEIGHT + Math.abs(dy) * LATERAL_WEIGHT;
        }
        break;
      case "ArrowLeft":
        if (center.x < currentCenter.x - 2) {
          return Math.abs(dx) * AXIAL_WEIGHT + Math.abs(dy) * LATERAL_WEIGHT;
        }
        break;
      case "ArrowDown":
        if (center.y > currentCenter.y + 2) {
          return Math.abs(dy) * AXIAL_WEIGHT + Math.abs(dx) * LATERAL_WEIGHT;
        }
        break;
      case "ArrowUp":
        if (center.y < currentCenter.y - 2) {
          return Math.abs(dy) * AXIAL_WEIGHT + Math.abs(dx) * LATERAL_WEIGHT;
        }
        break;
    }
    return null;
  }

  private static findBestElement(
    key: string,
    elements: HTMLElement[],
    active: HTMLElement,
    currentCenter: { x: number; y: number },
  ): HTMLElement | null {
    let bestElement: HTMLElement | null = null;
    let minScore = Infinity;

    for (const el of elements) {
      if (el === active) continue;
      const center = UIUtils.getElementCenter(el);
      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;
      const score = UIUtils.calcDirectionScore({ key, dx, dy, center, currentCenter });
      if (score !== null && score < minScore) {
        minScore = score;
        bestElement = el;
      }
    }

    return bestElement;
  }

  private static handleWrapNavigation(
    key: string,
    elements: HTMLElement[],
    active: HTMLElement,
  ): boolean {
    if (key === "ArrowDown" || key === "ArrowUp") {
      const sorted = [...elements].sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      );
      if (key === "ArrowDown" && sorted[sorted.length - 1] === active) {
        sorted[0].focus();
        return true;
      }
      if (key === "ArrowUp" && sorted[0] === active) {
        sorted[sorted.length - 1].focus();
        return true;
      }
    }

    if (key === "ArrowRight" || key === "ArrowLeft") {
      const sorted = [...elements].sort(
        (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
      );
      if (key === "ArrowRight" && sorted[sorted.length - 1] === active) {
        sorted[0].focus();
        return true;
      }
      if (key === "ArrowLeft" && sorted[0] === active) {
        sorted[sorted.length - 1].focus();
        return true;
      }
    }

    return false;
  }
}
