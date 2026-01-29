import { MenuState } from "@src/renderer/MenuConfig";

/**
 * Manages the stack of menu states and transitions between them.
 * Pure logic, no knowledge of the renderer.
 */
export class MenuStateMachine {
  private _state: MenuState = "ACTION_SELECT";
  private _stack: MenuState[] = [];
  private _breadcrumbs: string[] = [];

  get state(): MenuState {
    return this._state;
  }

  set state(value: MenuState) {
    this._state = value;
  }

  get stack(): MenuState[] {
    return this._stack;
  }

  set stack(value: MenuState[]) {
    this._stack = value;
  }

  get breadcrumbs(): string[] {
    return this._breadcrumbs;
  }

  public push(nextState: MenuState, label?: string) {
    this._stack.push(this._state);
    this._state = nextState;
    if (label) {
      this._breadcrumbs.push(label);
    }
  }

  public pop(): MenuState | null {
    const prevState = this._stack.pop();
    if (prevState) {
      this._state = prevState;
      this._breadcrumbs.pop();
      return prevState;
    }
    return null;
  }

  public reset() {
    this._state = "ACTION_SELECT";
    this._stack = [];
    this._breadcrumbs = [];
  }
}
