export class UIUtils {
  /**
   * Handles arrow key navigation within a container's focusable elements.
   * @returns true if the event was handled (focus changed)
   */
  public static handleArrowNavigation(e: KeyboardEvent, container: HTMLElement): boolean {
    const focusableElements = Array.from(
      container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !(el as any).disabled
      );
    });

    if (focusableElements.length === 0) return false;

    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

    let nextIndex = 0;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % focusableElements.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
    } else {
      return false;
    }

    focusableElements[nextIndex].focus();
    return true;
  }
}
