import { RenderableMenuState } from "../MenuController";

export class MenuRenderer {
  public static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  public static renderMenu(state: RenderableMenuState): string {
    let html = `<h3>${this.escapeHtml(state.title)}</h3>`;

    if (state.error) {
      html += `<p style="color:var(--color-danger);">${this.escapeHtml(state.error)}</p>`;
    }

    state.options.forEach((opt) => {
      let style = "";
      let cssClass = "menu-item";

      if (opt.disabled) {
        style = 'style="color: var(--color-text-dim); cursor: not-allowed;"';
      } else {
        cssClass += " clickable";
        if (opt.isBack) {
          style = 'style="color: var(--color-warning); margin-top: 10px;"';
        }
      }

      let dataAttrs = "";
      if (opt.dataAttributes) {
        Object.entries(opt.dataAttributes).forEach(([k, v]) => {
          dataAttrs += ` data-${k}="${this.escapeHtml(v)}"`;
        });
      }

      html += `<div class="${cssClass}" ${dataAttrs} ${style}>${this.escapeHtml(opt.label)}</div>`;
    });

    if (state.footer) {
      html += `<p style="color:var(--color-text-muted); font-size:0.8em; margin-top:10px;">${this.escapeHtml(state.footer)}</p>`;
    }

    return html;
  }
}
