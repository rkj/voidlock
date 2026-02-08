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
    const style = [];
    if (options.fontSize) style.push(`font-size: ${options.fontSize}`);
    if (options.color) style.push(`--stat-value-color: ${options.color}`);
    if (options.gap) style.push(`gap: ${options.gap}`);

    const inlineStyle = style.length > 0 ? `style="${style.join("; ")}"` : "";
    const imgStyle = options.iconSize
      ? `style="width:${options.iconSize}; height:${options.iconSize};"`
      : "";

    return `
      <span class="stat-display" ${inlineStyle} title="${title}" data-tooltip="${title}">
        <img src="${icon}" ${imgStyle} />
        <span class="stat-value">${value}</span>
      </span>
    `.trim();
  }

  /**
   * Updates an existing stat-display element with a new value.
   * Assumes the element was created with the StatDisplay structure.
   */
  public static update(el: HTMLElement, value: string | number) {
    const valSpan = el.querySelector(".stat-value");
    if (valSpan && valSpan.textContent !== value.toString()) {
      valSpan.textContent = value.toString();
    }
  }
}
