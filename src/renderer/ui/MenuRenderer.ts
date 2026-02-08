import { RenderableMenuState } from "@src/renderer/MenuController";

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
    let html = "";

    if (state.breadcrumbs && state.breadcrumbs.length > 0) {
      const breadcrumbsHtml = state.breadcrumbs
        .map((b) => this.escapeHtml(b))
        .join(" &gt; ");
      html += `<div class="menu-breadcrumbs">${breadcrumbsHtml}</div>`;
    }

    html += `<h3 class="menu-title">${this.escapeHtml(state.title)}</h3>`;

    if (state.error) {
      html += `<p class="menu-error">${this.escapeHtml(state.error)}</p>`;
    }

    state.options.forEach((opt) => {
      let cssClass = "menu-item";
      if (opt.disabled) {
        cssClass += " disabled";
      } else {
        cssClass += " clickable";
        if (opt.isBack) {
          cssClass += " menu-item-back";
        }
      }

      let dataAttrs = "";
      if (opt.dataAttributes) {
        Object.entries(opt.dataAttributes).forEach(([k, v]) => {
          dataAttrs += ` data-${k}="${this.escapeHtml(v)}"`;
        });
      }

      html += `<div class="${cssClass}" ${dataAttrs}>${this.escapeHtml(opt.label)}</div>`;
    });

    if (state.footer) {
      html += `<p class="menu-footer-text">${this.escapeHtml(state.footer)}</p>`;
    }

    return html;
  }
}
