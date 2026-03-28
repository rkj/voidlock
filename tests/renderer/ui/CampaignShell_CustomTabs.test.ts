/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("CampaignShell Custom Mode Tabs", () => {
  let container: HTMLElement;
  let shell: CampaignShell;
  let mockManager: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-campaign-shell"></div>';
    container = document.getElementById("screen-campaign-shell")!;

    mockManager = {
      getState: vi.fn(() => null), // Custom mode
      getSyncStatus: vi.fn(() => "synced"),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
    };

    const mockMetaManager = {
      getStats: vi.fn().mockReturnValue({
        totalKills: 100,
        totalCampaignsStarted: 5,
        totalMissionsWon: 20,
      }),
    };

    shell = new CampaignShell({ containerId: "screen-campaign-shell",
      manager: mockManager,
      metaManager: mockMetaManager as any,
      onTabChange: vi.fn(),
      onMenu: vi.fn(),
      inputDispatcher: { pushContext: vi.fn(), popContext: vi.fn() } as any });
  });

  it("should render Protocol, Terminal and Asset Logs tabs in custom mode", () => {
    shell.show("custom");

    const shellContainer = document.getElementById("screen-campaign-shell")!;
    const buttons = Array.from(shellContainer.querySelectorAll("button"));
    const labels = buttons.map((b) => b.textContent);

    expect(labels).toContain(t(I18nKeys.hud.shell.protocol));
    expect(labels).toContain(t(I18nKeys.hud.shell.terminal));
    expect(labels).toContain(t(I18nKeys.hud.shell.asset_logs));
  });
});
