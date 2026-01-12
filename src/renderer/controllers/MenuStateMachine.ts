import { MenuState } from "@src/renderer/MenuConfig";

/**
 * Manages the stack of menu states and transitions between them.
 * Pure logic, no knowledge of the renderer.
 */
export class MenuStateMachine {
  private _state: MenuState = "ACTION_SELECT";
  private _stack: MenuState[] = [];

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

  public push(nextState: MenuState) {
    this._stack.push(this._state);
    this._state = nextState;
  }

  public pop(): MenuState | null {
    const prevState = this._stack.pop();
    if (prevState) {
      this._state = prevState;
      return prevState;
    }
    return null;
  }

  public reset() {
    this._state = "ACTION_SELECT";
    this._stack = [];
  }
}
