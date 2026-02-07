export interface ShortcutInfo {
  key: string;
  code?: string; // Optional specific KeyboardEvent.code
  label: string;
  description: string;
  category: "General" | "Tactical" | "Navigation" | "Menu";
}

export interface InputContext {
  id: string;
  priority: number; // Higher numbers handle events first
  trapsFocus: boolean; // If true, prevents focus from leaving the associated container
  container?: HTMLElement; // The container to trap focus within
  handleKeyDown(e: KeyboardEvent): boolean; // returns true if consumed
  handleTouchStart?(e: TouchEvent): boolean;
  handleTouchMove?(e: TouchEvent): boolean;
  handleTouchEnd?(e: TouchEvent): boolean;
  handleMouseDown?(e: MouseEvent): boolean;
  handleMouseMove?(e: MouseEvent): boolean;
  handleMouseUp?(e: MouseEvent): boolean;
  handleWheel?(e: WheelEvent): boolean;
  getShortcuts(): ShortcutInfo[];
}

export enum InputPriority {
  Global = 0,
  Game = 50,
  UI = 100,
  Overlay = 500,
  System = 1000,
}
