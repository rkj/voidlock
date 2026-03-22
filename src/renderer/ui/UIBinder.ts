import type { GameState } from "@src/shared/types";

export type Transformer = (value: unknown, state: GameState) => unknown;

interface Binding {
  element: HTMLElement;
  attr: string; // text, value, style.width, visibility, etc.
  path: string;
  transformer?: Transformer;
  lastValue: unknown;
  baseClassName?: string;
  isAdditiveClass?: boolean;
}

/**
 * UIBinder: A lightweight reactive UI data binding system.
 * Implements dirty-checking to synchronize GameState with DOM elements
 * marked with data-bind-* attributes.
 */
export class UIBinder {
  private bindings: Binding[] = [];
  private transformers: Record<string, Transformer> = {};

  /**
   * Registers a transformation function for use in data-bind-transform.
   */
  public registerTransformer(name: string, transformer: Transformer) {
    this.transformers[name] = transformer;
  }

  /**
   * Scans the DOM for data-bind-* attributes and initializes bindings.
   */
  public initialize(root: HTMLElement = document.body) {
    // If scanning a sub-tree, remove any existing bindings within that root to prevent duplicates
    if (root !== document.body) {
      this.bindings = this.bindings.filter(b => !root.contains(b.element));
    } else {
      this.bindings = [];
    }
    
    const allElements = root.querySelectorAll("*");
    // Also check the root itself
    const elementsToScan = [root, ...Array.from(allElements)];

    elementsToScan.forEach(el => {
      if (!(el instanceof HTMLElement)) return;

      const attrs = el.attributes;

      // Find transformer first if it exists
      const transformAttr = el.getAttribute("data-bind-transform");

      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        if (attr.name.startsWith("data-bind-") && attr.name !== "data-bind-transform") {
          const bindType = attr.name.replace("data-bind-", "");
          const parts = attr.value.split("|");
          const path = parts[0];
          const localTransformerName = parts[1] || transformAttr;
          const localTransformer = localTransformerName ? this.transformers[localTransformerName] : undefined;
          
          const isClassBinding = bindType === "class";
          const hasExistingClass = el.hasAttribute("class");
          const hasPipeTransformer = parts.length > 1;

          this.bindings.push({
            element: el,
            attr: bindType,
            path,
            transformer: localTransformer,
            lastValue: undefined,
            baseClassName: isClassBinding ? (el.getAttribute("class") || "") : undefined,
            isAdditiveClass: isClassBinding && hasExistingClass && hasPipeTransformer
          });
        }
      }
    });
  }

  /**
   * Resets all bindings and rescans the DOM.
   */
  public reset(root: HTMLElement = document.body) {
    this.bindings = [];
    this.initialize(root);
  }

  /**
   * Forces a full update of all bound elements by clearing their cached lastValue.
   */
  public rebind() {
    for (const binding of this.bindings) {
      binding.lastValue = undefined;
    }
  }

  /**
   * Returns true if there are active bindings.
   */
  public hasBindings(): boolean {
    return this.bindings.length > 0;
  }

  /**
   * Synchronizes the DOM with the provided GameState.
   * Only updates elements whose bound values have changed.
   */
  public sync(state: GameState) {
    if (this.bindings.length === 0) return;
    // Logger.debug(`[UIBinder] sync tick=${state.t}, bindings=${this.bindings.length}`);
    for (const binding of this.bindings) {
      const rawValue = this.getValueByPath(state, binding.path);
      const value = binding.transformer ? binding.transformer(rawValue, state) : rawValue;

      if (value !== binding.lastValue) {
        binding.lastValue = value;
        this.updateElement(binding, value);
      }
    }
  }

  private getValueByPath(obj: unknown, path: string): unknown {
    if (!path) return obj;
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private updateElement(binding: Binding, value: unknown) {
    const el = binding.element;
    const attr = binding.attr;

    // Set a flag so listeners can distinguish between programmatic and user-initiated changes
    el.setAttribute("data-is-binding", "true");
    
    try {
      switch (attr) {
        case "text":
          if (el.textContent !== String(value)) {
            el.textContent = String(value);
          }
          break;
        case "value":
          if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
            // Optimization: Do not overwrite the value if the element is currently being interacted with (focused)
            if (el === document.activeElement) break;

            if (el.value !== String(value)) {
              el.value = String(value);
              // Dispatch input event so listeners (like the speed control) can react if needed
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
          break;
        case "min":
        case "max":
        case "step":
          if (el instanceof HTMLInputElement) {
            if (el.getAttribute(attr) !== String(value)) {
              el.setAttribute(attr, String(value));
            }
          }
          break;
        case "style-width":
          el.style.width = typeof value === "number" ? `${value}%` : String(value);
          break;
        case "visibility":
          el.style.visibility = value ? "visible" : "hidden";
          break;
        case "display":
          el.style.display = value ? "" : "none";
          break;
        case "class":
          if (typeof value === "string") {
            if (binding.isAdditiveClass) {
              const newClass = (`${binding.baseClassName  } ${  value}`).trim();
              if (el.className !== newClass) {
                el.className = newClass;
              }
            } else if (el.className !== value) {
                el.className = value;
              }
          }
          break;
        default:
          // Handle style.prop or direct attribute
          if (attr.startsWith("style-")) {
            const styleProp = attr.replace("style-", "");
            const style = el.style as unknown as Record<string, string>;
            style[styleProp] = String(value);
          } else {
            el.setAttribute(attr, String(value));
          }
      }
    } finally {
      el.removeAttribute("data-is-binding");
    }
  }
}
