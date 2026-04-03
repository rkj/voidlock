import { describe, it, expect } from "vitest";
import { pl } from "@src/renderer/i18n/locales/pl";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("Polish I18n Completeness", () => {
  it("should have all mission setup keys translated", () => {
    const missingKeys = [
      I18nKeys.mission.setup.assigned_assets,
      I18nKeys.mission.setup.asset_reserve,
      I18nKeys.mission.setup.operational_deployment,
      I18nKeys.mission.setup.empty_slot,
      I18nKeys.mission.setup.vip_label,
      I18nKeys.mission.setup.recruit_btn,
      I18nKeys.mission.setup.revive_btn,
      I18nKeys.mission.setup.error_empty,
      I18nKeys.mission.setup.error_max,
    ];

    missingKeys.forEach(key => {
      expect(pl[key as keyof typeof pl], `Missing translation for key: ${key}`).toBeDefined();
    });
  });

  it("should have correct Polish text for mission setup keys", () => {
    expect(pl[I18nKeys.mission.setup.assigned_assets as keyof typeof pl]).toBe("Przypisani żołnierze: {current}/{max}");
    expect(pl[I18nKeys.mission.setup.asset_reserve as keyof typeof pl]).toBe("Kadra");
    expect(pl[I18nKeys.mission.setup.operational_deployment as keyof typeof pl]).toBe("Rozmieszczenie oddziału");
    expect(pl[I18nKeys.mission.setup.empty_slot as keyof typeof pl]).toBe("(Puste)");
    expect(pl[I18nKeys.mission.setup.vip_label as keyof typeof pl]).toBe("VIP");
    expect(pl[I18nKeys.mission.setup.recruit_btn as keyof typeof pl]).toBe("Rekrutuj nowego żołnierza ({cost} kredytów)");
    expect(pl[I18nKeys.mission.setup.revive_btn as keyof typeof pl]).toBe("Przywróć żołnierza ({cost} kredytów)");
    expect(pl[I18nKeys.mission.setup.error_empty as keyof typeof pl]).toBe("Wybierz przynajmniej jednego żołnierza, aby rozpocząć misję");
    expect(pl[I18nKeys.mission.setup.error_max as keyof typeof pl]).toBe("Dozwolonych jest maksymalnie {max} żołnierzy");
  });
});
