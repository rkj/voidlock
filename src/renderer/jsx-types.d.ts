/**
 * Type definitions for Vanilla TSX
 */

declare function createElement(
  tag: string | Function,
  props: Record<string, any> | null,
  ...children: any[]
): HTMLElement | DocumentFragment;

declare function Fragment({ children }: { children?: any }): DocumentFragment;

declare namespace JSX {
  type Element = HTMLElement | DocumentFragment;

  interface IntrinsicElements {
    [tagName: string]: Omit<Partial<HTMLElement>, "style"> & {
      class?: string;
      children?: any;
      onClick?: (e: MouseEvent) => void;
      onChange?: (e: Event) => void;
      onInput?: (e: InputEvent) => void;
      onKeyDown?: (e: KeyboardEvent) => void;
      onKeyUp?: (e: KeyboardEvent) => void;
      onMouseDown?: (e: MouseEvent) => void;
      onMouseUp?: (e: MouseEvent) => void;
      onMouseMove?: (e: MouseEvent) => void;
      onMouseEnter?: (e: MouseEvent) => void;
      onMouseLeave?: (e: MouseEvent) => void;
      onTouchStart?: (e: TouchEvent) => void;
      onTouchEnd?: (e: TouchEvent) => void;
      onTouchMove?: (e: TouchEvent) => void;
      style?: Partial<CSSStyleDeclaration> | Record<string, string | number>;
      ref?: (el: HTMLElement) => void;
      // Allow any other attributes
      [key: string]: any;
    };
  }
}
