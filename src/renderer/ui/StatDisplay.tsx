import { createElement } from "@src/renderer/jsx";

export interface StatDisplayProps {
  icon: string;
  value: string | number;
  title: string;
  fontSize?: string;
  iconSize?: string;
  color?: string;
  gap?: string;
}

export function StatDisplayComponent(props: StatDisplayProps) {
  const style: Record<string, string> = {};
  if (props.fontSize) style.fontSize = props.fontSize;
  if (props.color) style["--stat-value-color"] = props.color;
  if (props.gap) style.gap = props.gap;

  const imgStyle: Record<string, string> = {};
  if (props.iconSize) {
    imgStyle.width = props.iconSize;
    imgStyle.height = props.iconSize;
  }

  return (
    <span
      class="stat-display"
      style={style}
      title={props.title}
      data-tooltip={props.title}
    >
      <img src={props.icon} style={imgStyle} />
      <span class="stat-value">{props.value}</span>
    </span>
  );
}

export class StatDisplay {
  /**
   * Renders a standardized stat block as a string for template literals.
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
   */
  public static update(el: HTMLElement, value: string | number) {
    const valSpan = el.querySelector(".stat-value");
    if (valSpan && valSpan.textContent !== value.toString()) {
      valSpan.textContent = value.toString();
    }
  }
}
