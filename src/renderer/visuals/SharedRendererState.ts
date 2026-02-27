import { UnitStyle, OverlayOption, Cell } from "@src/shared/types";
import { Graph } from "@src/engine/Graph";

export class SharedRendererState {
  public cellSize: number = 128;
  public unitStyle: UnitStyle = UnitStyle.TacticalIcons;
  public overlayOptions: OverlayOption[] = [];
  public graph: Graph | null = null;
  public currentMapId: string | null = null;
  public cells: Cell[] = [];

  public destroy() {
    this.graph = null;
    this.cells = [];
    this.currentMapId = null;
    this.overlayOptions = [];
  }
}
