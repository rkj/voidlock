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
    const wrap = options.wrap !== undefined ? options.wrap : true;

    // Filter keys by orientation
    if (orientation === "vertical") {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") return false;
    } else if (orientation === "horizontal") {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") return false;
    }

    const focusableElements = Array.from(
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

    if (focusableElements.length === 0) return false;

    const active = document.activeElement as HTMLElement;
    if (!active || !container.contains(active)) {
      focusableElements[0].focus();
      return true;
    }

    const currentRect = active.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2,
    };

    let bestElement: HTMLElement | null = null;
    let minScore = Infinity;

    for (const el of focusableElements) {
      if (el === active) continue;

      const rect = el.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;

      let isMatch = false;
      let score = 0;

      // Weight axial distance more than lateral distance
      const AXIAL_WEIGHT = 1;
      const LATERAL_WEIGHT = 2;

      switch (e.key) {
        case "ArrowRight":
          if (center.x > currentCenter.x + 1) {
            // +1 to avoid precision issues
            isMatch = true;
            score = Math.abs(dx) * AXIAL_WEIGHT + Math.abs(dy) * LATERAL_WEIGHT;
          }
          break;
        case "ArrowLeft":
          if (center.x < currentCenter.x - 1) {
            isMatch = true;
            score = Math.abs(dx) * AXIAL_WEIGHT + Math.abs(dy) * LATERAL_WEIGHT;
          }
          break;
        case "ArrowDown":
          if (center.y > currentCenter.y + 1) {
            isMatch = true;
            score = Math.abs(dy) * AXIAL_WEIGHT + Math.abs(dx) * LATERAL_WEIGHT;
          }
          break;
        case "ArrowUp":
          if (center.y < currentCenter.y - 1) {
            isMatch = true;
            score = Math.abs(dy) * AXIAL_WEIGHT + Math.abs(dx) * LATERAL_WEIGHT;
          }
          break;
      }

      if (isMatch && score < minScore) {
        minScore = score;
        bestElement = el;
      }
    }

    if (bestElement) {
      bestElement.focus();
      return true;
    }

    // Wrap-around logic: Only wrap if it matches the axis of intended movement
    if (wrap) {
      // For vertical lists, ArrowDown at bottom wraps to top
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const sorted = [...focusableElements].sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        );
        if (e.key === "ArrowDown" && sorted[sorted.length - 1] === active) {
          sorted[0].focus();
          return true;
        }
        if (e.key === "ArrowUp" && sorted[0] === active) {
          sorted[sorted.length - 1].focus();
          return true;
        }
      }

      // For horizontal lists, ArrowRight at end wraps to start
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const sorted = [...focusableElements].sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        );
        if (e.key === "ArrowRight" && sorted[sorted.length - 1] === active) {
          sorted[0].focus();
          return true;
        }
        if (e.key === "ArrowLeft" && sorted[0] === active) {
          sorted[sorted.length - 1].focus();
          return true;
        }
      }
    }

    return false;
  }
}
