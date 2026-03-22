/**
 * Custom JSX Factory for Vanilla TSX
 * Converts TSX syntax directly into native DOM elements.
 */

export function Fragment({ children }: { children?: any }): DocumentFragment {
  const fragment = document.createDocumentFragment();
  appendChildren(fragment, Array.isArray(children) ? children : [children]);
  return fragment;
}

function appendChildren(parent: Node, children: any[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }

    if (Array.isArray(child)) {
      appendChildren(parent, child);
    } else if (child instanceof Node) {
      parent.appendChild(child);
    } else {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }
}

export function createElement(
  tag: string | Function,
  props: Record<string, any> | null,
  ...children: any[]
): HTMLElement | DocumentFragment {
  if (typeof tag === "function") {
    // For Fragments, children is already passed in props by the JSX transformer
    // but we also get it in ...children.
    // In React-style factory, children are passed as rest arguments.
    return tag({ ...props, children });
  }

  const element = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "className" || key === "class") {
        element.className = value;
      } else if (key === "style" && typeof value === "object") {
        Object.assign(element.style, value);
      } else if (key.startsWith("on") && typeof value === "function") {
        const eventName = key.toLowerCase().substring(2);
        element.addEventListener(eventName, value);
      } else if (key === "children") {
        // Handled by ...children rest parameter
      } else if (key === "ref" && typeof value === "function") {
        value(element);
      } else if (
        key === "disabled" ||
        key === "checked" ||
        key === "selected" ||
        key === "value"
      ) {
        (element as any)[key] = value;
      } else {
        element.setAttribute(key, value);
      }
    }
  }

  appendChildren(element, children);

  return element;
}

window.createElement = createElement;
window.Fragment = Fragment;
