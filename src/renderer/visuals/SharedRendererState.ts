import type { OverlayOption, Cell } from "@src/shared/types";
import { UnitStyle } from "@src/shared/types";
import type { Graph } from "@src/engine/Graph";
import type { ThemeManager } from "../ThemeManager";
import type { AssetManager } from "./AssetManager";

export class SharedRendererState {
  public cellSize: number = 128;
  public unitStyle: UnitStyle = UnitStyle.TacticalIcons;
  public overlayOptions: OverlayOption[] = [];
  public graph: Graph | null = null;
  public currentMapId: string | null = null;
  public cells: Cell[] = [];

  constructor(
    public theme: ThemeManager,
    public assets: AssetManager,
  ) {}

  public destroy() {
    this.graph = null;
    this.cells = [];
    this.currentMapId = null;
    this.overlayOptions = [];
  }
}
