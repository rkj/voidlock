import { GameClient } from "../engine/GameClient";
import { Bot } from "./Bot";

export class BotHarness {
  constructor(
    private client: GameClient,
    private bot: Bot,
  ) {}

  public start() {
    this.client.onStateUpdate((state) => {
      // Basic rate limiting or logic could go here
      const cmd = this.bot.act(state);
      if (cmd) {
        this.client.sendCommand(cmd);
      }
    });
  }
}
