export class StatDisplay {
  /**
   * Renders a standardized stat block with an icon, value, and tooltip.
   * @param icon The icon URL (from Icons library)
   * @param value The value to display
   * @param title The tooltip title
   * @param options Optional styling overrides
   */
  public static render(
    icon: string,
    value: string | number,
    title: string,
    options: {
      fontSize?: string;
      iconSize?: string;
      color?: string;
      gap?: string;
    } = {},
  ): string {
    const fontSize = options.fontSize || "inherit";
    const iconSize = options.iconSize || "12px";
    const color = options.color || "var(--color-text)";
    const gap = options.gap || "2px";

    return `
      <span class="stat-display" style="display:inline-flex; align-items:center; gap:${gap}; font-size:${fontSize};" title="${title}">
        <img src="${icon}" style="width:${iconSize}; height:${iconSize};" />
        <span style="color:${color}">${value}</span>
      </span>
    `.trim();
  }
}
