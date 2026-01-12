
import { GameClient } from "@src/engine/GameClient";
import { Renderer } from "@src/renderer/Renderer";
import { ScreenManager } from "@src/renderer/ScreenManager";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { MenuController } from "@src/renderer/MenuController";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { InputManager } from "@src/renderer/InputManager";

/**
 * AppContext serves as a simple Dependency Injection container or Service Locator.
 * It holds references to various managers and controllers to allow for easy mocking in tests.
 */
export class AppContext {
  public gameClient!: GameClient;
  public renderer?: Renderer;
  public screenManager!: ScreenManager;
  public campaignManager!: CampaignManager;
  public themeManager!: ThemeManager;
  public menuController!: MenuController;
  public hudManager!: HUDManager;
  public inputManager!: InputManager;
  public configManager = ConfigManager; // Static class reference
}
